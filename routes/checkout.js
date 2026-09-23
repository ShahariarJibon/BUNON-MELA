const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const db = require('../database/db');

// Load Bangladesh locations data
let bdLocations = { divisions: [] };
try {
  const locPath = path.resolve(__dirname, '../bd_locations.json');
  if (fs.existsSync(locPath)) {
    bdLocations = JSON.parse(fs.readFileSync(locPath, 'utf8'));
  }
} catch (e) {
  console.error('Error reading bd_locations.json:', e.message);
}

const DHAKA_UPAZILAS = [
  "Dhanmondi", "Gulshan", "Banani", "Uttara", "Mirpur", "Mohammadpur",
  "Motijheel", "Tejgaon", "Savar", "Keraniganj", "Dhamrai", "Nawabganj", "Dohar"
];

// Helper to fetch cart items for current checkout session
function getCheckoutCart(req, callback) {
  if (req.session && req.session.user) {
    const userId = req.session.user.id;
    const query = `
      SELECT c.id AS cart_id, c.quantity, p.id AS product_id, p.title, p.price, p.image_url
      FROM CartItems c
      JOIN Products p ON c.product_id = p.id
      WHERE c.user_id = ?
      ORDER BY c.id DESC
    `;
    db.all(query, [userId], (err, items) => {
      if (err) return callback(err, []);
      if (items && items.length > 0) return callback(null, items);
      // Fallback to session cart if DB cart is empty
      const sessionCart = req.session.cart || [];
      return callback(null, sessionCart);
    });
  } else {
    const sessionCart = (req.session && req.session.cart) ? req.session.cart : [];
    return callback(null, sessionCart);
  }
}

// GET /checkout/locations — JSON API for dynamic dropdown cascading
router.get('/locations', (req, res) => {
  res.json({
    ...bdLocations,
    dhakaUpazilas: DHAKA_UPAZILAS
  });
});

// POST /checkout/validate-coupon — Check promo coupon code (No login required)
router.post('/validate-coupon', (req, res) => {
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

// GET /checkout — Checkout page (Direct 1-Click checkout, no prior account needed!)
router.get('/', (req, res) => {
  getCheckoutCart(req, (err, items) => {
    if (err || !items || items.length === 0) {
      return res.redirect('/cart');
    }

    const subtotal = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);

    res.render('checkout', {
      title: 'Bespoke Checkout | Bunonmela',
      items,
      subtotal,
      divisions: bdLocations.divisions || [],
      dhakaUpazilas: DHAKA_UPAZILAS,
      user: req.session ? req.session.user : null,
      formData: {},
      error: null
    });
  });
});

// POST /checkout — Submit order & auto-create customer profile by mobile number
router.post('/', async (req, res) => {
  const {
    customer_name,
    customer_phone,
    customer_email,
    division,
    district,
    upazila,
    area,
    payment_method,
    transaction_id,
    coupon_code
  } = req.body;

  const renderWithError = (msg) => {
    getCheckoutCart(req, (err, items) => {
      const subtotal = (items || []).reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
      res.render('checkout', {
        title: 'Bespoke Checkout | Bunonmela',
        items: items || [],
        subtotal,
        divisions: bdLocations.divisions || [],
        dhakaUpazilas: DHAKA_UPAZILAS,
        user: req.session ? req.session.user : null,
        formData: req.body,
        error: msg
      });
    });
  };

  // 1. Validation: Name
  if (!customer_name || !customer_name.trim()) {
    return renderWithError('Recipient name is required.');
  }

  // 2. Validation: Bangladeshi Mobile Number (11 digits, valid provider: 013, 014, 015, 016, 017, 018, 019)
  let cleanPhone = (customer_phone || '').trim().replace(/[\s\-\(\)]/g, '');
  if (cleanPhone.startsWith('+88')) cleanPhone = cleanPhone.slice(3);
  if (cleanPhone.startsWith('88')) cleanPhone = cleanPhone.slice(2);

  const bdPhoneRegex = /^01[3-9]\d{8}$/;
  if (!bdPhoneRegex.test(cleanPhone)) {
    return renderWithError('Please enter a valid 11-digit Bangladeshi mobile number (e.g. 017XXXXXXXX, 018XXXXXXXX, 019XXXXXXXX).');
  }

  // 3. Validation: Address
  if (!division || !district || !upazila) {
    return renderWithError('Please select your Division, District, and Upazila.');
  }

  if (!area || !area.trim()) {
    return renderWithError('Please enter your specific street, house, or road address.');
  }

  // 4. Validation: Payment Method & TrxID
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

  // 5. Fetch current cart
  getCheckoutCart(req, (err, cartItems) => {
    if (err || !cartItems || cartItems.length === 0) {
      return res.redirect('/cart');
    }

    const subtotal = cartItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    const isDhaka = DHAKA_UPAZILAS.some(u => u.toLowerCase() === (upazila || '').trim().toLowerCase());
    const baseDelivery = isDhaka ? 70 : 130;

    const rawCoupon = (coupon_code || '').trim();

    // 6. Find or Auto-Create User Profile by Mobile Number
    const cleanEmail = (customer_email || '').trim().toLowerCase();

    // Helper to finalize order once user profile is resolved
    const finalizeOrder = (userId, finalDeliveryCharge, verifiedCoupon) => {
      const totalAmount = subtotal + finalDeliveryCharge;
      const orderNumber = 'BNM-' + Math.floor(100000 + Math.random() * 900000);
      const fullAddress = `${area.trim()}, ${upazila}, ${district}, ${division}`;

      const insertOrderSql = `
        INSERT INTO Orders (
          order_number, user_id, customer_name, customer_phone, customer_email,
          division, district, upazila, area, delivery_address,
          payment_method, transaction_id, total_amount, status,
          delivery_charge, coupon_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?)
      `;

      db.run(
        insertOrderSql,
        [
          orderNumber,
          userId,
          customer_name.trim(),
          cleanPhone,
          cleanEmail || null,
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
            insertItemStmt.run(orderId, item.product_id, item.title, Number(item.price), Number(item.quantity));
          });

          insertItemStmt.finalize((stmtErr) => {
            if (stmtErr) {
              console.error('Error inserting order items:', stmtErr.message);
            }

            // Clear cart in session and in DB
            if (req.session) req.session.cart = [];
            db.run('DELETE FROM CartItems WHERE user_id = ?', [userId], () => {
              res.redirect(`/checkout/success/${orderId}`);
            });
          });
        }
      );
    };

    // Calculate delivery charge according to coupon
    const proceedWithDeliveryCalc = (userId) => {
      if (rawCoupon) {
        db.get('SELECT * FROM Coupons WHERE UPPER(code) = UPPER(?)', [rawCoupon], (cErr, couponRow) => {
          if (!cErr && couponRow) {
            finalizeOrder(userId, 0, couponRow.code);
          } else {
            finalizeOrder(userId, baseDelivery, null);
          }
        });
      } else {
        finalizeOrder(userId, baseDelivery, null);
      }
    };

    // Profile lookup or creation by mobile number
    db.get('SELECT * FROM Users WHERE phone = ?', [cleanPhone], async (userErr, existingUser) => {
      if (existingUser) {
        // User already has a profile with this mobile number
        const userId = existingUser.id;
        // If an email was provided now, update the profile email if needed
        if (cleanEmail && (!existingUser.email || existingUser.email.endsWith('@bunonmela.customer'))) {
          db.run('UPDATE Users SET email = ? WHERE id = ?', [cleanEmail, userId]);
        }

        // Auto-login to session as customer (strictly customer role, never elevate to admin via checkout)
        if (existingUser.role !== 'admin') {
          req.session.user = {
            id: existingUser.id,
            name: customer_name.trim() || existingUser.name,
            phone: cleanPhone,
            email: cleanEmail || existingUser.email,
            role: 'customer'
          };
        }

        proceedWithDeliveryCalc(userId);
      } else {
        // Create brand new profile using mobile number
        const placeholderEmail = cleanEmail || `${cleanPhone}@bunonmela.customer`;
        const hashedPassword = await bcrypt.hash(cleanPhone, 10);

        // Check if placeholder email already exists in Users
        db.get('SELECT id FROM Users WHERE email = ?', [placeholderEmail], (emErr, emailUser) => {
          const finalEmail = (emailUser && !cleanEmail) ? `${cleanPhone}_${Date.now()}@bunonmela.customer` : placeholderEmail;

          db.run(
            'INSERT INTO Users (name, email, phone, password, role) VALUES (?, ?, ?, ?, "customer")',
            [customer_name.trim(), finalEmail, cleanPhone, hashedPassword],
            function (insErr) {
              const newUserId = this ? this.lastID : 1;

              // Auto-login to session so customer can view their profile and orders immediately
              req.session.user = {
                id: newUserId,
                name: customer_name.trim(),
                phone: cleanPhone,
                email: finalEmail,
                role: 'customer'
              };

              proceedWithDeliveryCalc(newUserId);
            }
          );
        });
      }
    });
  });
});

// GET /checkout/success/:id — Order Success invoice page
router.get('/success/:id', (req, res) => {
  const orderId = parseInt(req.params.id, 10);

  const orderSql = `SELECT * FROM Orders WHERE id = ?`;
  db.get(orderSql, [orderId], (err, order) => {
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
