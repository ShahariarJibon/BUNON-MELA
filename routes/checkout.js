const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../database/db');

// Load locations data
let bdLocations = { divisions: [] };
try {
  const locPath = path.resolve(__dirname, '../bd_locations.json');
  if (fs.existsSync(locPath)) {
    bdLocations = JSON.parse(fs.readFileSync(locPath, 'utf8'));
  }
} catch (e) {
  console.error('Error reading bd_locations.json:', e.message);
}

// Middleware: Require logged in user for checkout
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  const redirectUrl = req.originalUrl || '/checkout';
  res.redirect(`/auth/login?redirect=${encodeURIComponent(redirectUrl)}`);
}

const DHAKA_UPAZILAS = [
  "Dhanmondi", "Gulshan", "Banani", "Uttara", "Mirpur", "Mohammadpur",
  "Motijheel", "Tejgaon", "Savar", "Keraniganj", "Dhamrai", "Nawabganj", "Dohar"
];

// GET /checkout/locations — JSON API for dynamic dropdowns
router.get('/locations', (req, res) => {
  res.json({
    ...bdLocations,
    dhakaUpazilas: DHAKA_UPAZILAS
  });
});

// POST /checkout/validate-coupon — Check if coupon exists
router.post('/validate-coupon', requireAuth, (req, res) => {
  const code = (req.body.code || '').trim();
  if (!code) {
    return res.status(400).json({ valid: false, message: 'Please enter a coupon code.' });
  }

  db.get('SELECT * FROM Coupons WHERE UPPER(code) = UPPER(?)', [code], (err, coupon) => {
    if (err) {
      console.error('Error validating coupon:', err.message);
      return res.status(500).json({ valid: false, message: 'Server error validating coupon.' });
    }
    if (!coupon) {
      return res.json({ valid: false, message: 'Invalid or expired coupon code.' });
    }
    res.json({
      valid: true,
      code: coupon.code,
      discountType: 'free_delivery',
      message: `Coupon "${coupon.code}" applied! Free delivery granted.`
    });
  });
});

// GET /checkout — Checkout page
router.get('/', requireAuth, (req, res) => {
  const userId = req.session.user.id;

  const query = `
    SELECT c.id AS cart_id, c.quantity, p.id AS product_id, p.title, p.price, p.image_url
    FROM CartItems c
    JOIN Products p ON c.product_id = p.id
    WHERE c.user_id = ?
    ORDER BY c.id DESC
  `;

  db.all(query, [userId], (err, items) => {
    if (err) {
      console.error('Error fetching cart for checkout:', err.message);
      return res.redirect('/cart');
    }

    if (!items || items.length === 0) {
      return res.redirect('/cart');
    }

    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    res.render('checkout', {
      title: 'Bespoke Checkout | Bunonmela',
      items,
      subtotal,
      divisions: bdLocations.divisions || [],
      dhakaUpazilas: DHAKA_UPAZILAS,
      user: req.session.user,
      error: null
    });
  });
});

// POST /checkout — Submit order with status 'Pending'
router.post('/', requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const {
    customer_name,
    customer_phone,
    division,
    district,
    upazila,
    area,
    payment_method,
    transaction_id,
    coupon_code
  } = req.body;

  const renderWithError = (msg) => {
    const query = `
      SELECT c.id AS cart_id, c.quantity, p.id AS product_id, p.title, p.price, p.image_url
      FROM CartItems c
      JOIN Products p ON c.product_id = p.id
      WHERE c.user_id = ?
      ORDER BY c.id DESC
    `;
    db.all(query, [userId], (err, items) => {
      const subtotal = (items || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);
      res.render('checkout', {
        title: 'Bespoke Checkout | Bunonmela',
        items: items || [],
        subtotal,
        divisions: bdLocations.divisions || [],
        dhakaUpazilas: DHAKA_UPAZILAS,
        user: req.session.user,
        formData: req.body,
        error: msg
      });
    });
  };

  // Validation
  if (!customer_name || !customer_name.trim()) {
    return renderWithError('Recipient name is required.');
  }

  const phoneClean = (customer_phone || '').trim().replace(/[-+\s]/g, '');
  if (!phoneClean || phoneClean.length < 11) {
    return renderWithError('Please enter a valid Bangladeshi contact number (e.g. 017XXXXXXXX).');
  }

  if (!division || !district || !upazila) {
    return renderWithError('Please select your Division, District, and Upazila.');
  }

  if (!area || !area.trim()) {
    return renderWithError('Please enter your specific street, house, or road address.');
  }

  const validMethods = ['Cash on Delivery', 'bKash', 'Nagad', 'Online Bank Transfer'];
  const selectedMethod = validMethods.includes(payment_method) ? payment_method : 'Cash on Delivery';

  let trxId = (transaction_id || '').trim();
  if (selectedMethod !== 'Cash on Delivery') {
    if (!trxId) {
      return renderWithError(`Transaction ID (TrxID) is required for ${selectedMethod} payment.`);
    }
  } else {
    trxId = null;
  }

  // Fetch cart items
  const cartQuery = `
    SELECT c.quantity, p.id AS product_id, p.title, p.price
    FROM CartItems c
    JOIN Products p ON c.product_id = p.id
    WHERE c.user_id = ?
  `;

  db.all(cartQuery, [userId], (err, cartItems) => {
    if (err || !cartItems || cartItems.length === 0) {
      return res.redirect('/cart');
    }

    const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const isDhaka = DHAKA_UPAZILAS.some(u => u.toLowerCase() === (upazila || '').trim().toLowerCase());
    const baseDelivery = isDhaka ? 70 : 160;

    const rawCoupon = (coupon_code || '').trim();

    const proceedWithOrder = (finalDeliveryCharge, verifiedCoupon) => {
      const totalAmount = subtotal + finalDeliveryCharge;
      const orderNumber = 'BNM-' + Math.floor(100000 + Math.random() * 900000);
      const fullAddress = `${area.trim()}, ${upazila}, ${district}, ${division}`;

      // Insert Order
      const insertOrderSql = `
        INSERT INTO Orders (
          order_number, user_id, customer_name, customer_phone,
          division, district, upazila, area, delivery_address,
          payment_method, transaction_id, total_amount, status,
          delivery_charge, coupon_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?)
      `;

      db.run(
        insertOrderSql,
        [
          orderNumber,
          userId,
          customer_name.trim(),
          phoneClean,
          division,
          district,
          upazila,
          area.trim(),
          fullAddress,
          selectedMethod,
          trxId,
          totalAmount,
          finalDeliveryCharge,
          verifiedCoupon
        ],
        function (orderErr) {
          if (orderErr) {
            console.error('Error inserting order:', orderErr.message);
            return renderWithError('An error occurred while creating your order. Please try again.');
          }

          const orderId = this.lastID;

          // Insert Order Items
          const insertItemStmt = db.prepare(`
            INSERT INTO OrderItems (order_id, product_id, title, price, quantity)
            VALUES (?, ?, ?, ?, ?)
          `);

          cartItems.forEach((item) => {
            insertItemStmt.run(orderId, item.product_id, item.title, item.price, item.quantity);
          });

          insertItemStmt.finalize((stmtErr) => {
            if (stmtErr) {
              console.error('Error inserting order items:', stmtErr.message);
            }

            // Clear user's cart in SQLite and session
            db.run('DELETE FROM CartItems WHERE user_id = ?', [userId], () => {
              req.session.cart = [];
              res.redirect(`/checkout/success/${orderId}`);
            });
          });
        }
      );
    };

    if (rawCoupon) {
      db.get('SELECT * FROM Coupons WHERE UPPER(code) = UPPER(?)', [rawCoupon], (cErr, couponRow) => {
        if (!cErr && couponRow) {
          proceedWithOrder(0, couponRow.code);
        } else {
          proceedWithOrder(baseDelivery, null);
        }
      });
    } else {
      proceedWithOrder(baseDelivery, null);
    }
  });
});

// GET /checkout/success/:id — Luxurious Order Success page
router.get('/success/:id', requireAuth, (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  const userId = req.session.user.id;

  const orderSql = `SELECT * FROM Orders WHERE id = ? AND user_id = ?`;
  db.get(orderSql, [orderId, userId], (err, order) => {
    if (err || !order) {
      return res.redirect('/');
    }

    const itemsSql = `SELECT * FROM OrderItems WHERE order_id = ?`;
    db.all(itemsSql, [orderId], (itemsErr, items) => {
      res.render('order-success', {
        title: `Order Confirmed #${order.order_number} | Bunonmela`,
        order,
        items: items || []
      });
    });
  });
});

module.exports = router;
