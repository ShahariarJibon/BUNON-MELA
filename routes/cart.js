const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Helper to get cart items for current request (from DB or Session)
function getCartItems(req, callback) {
  if (req.session && req.session.user) {
    const userId = req.session.user.id;
    const query = `
      SELECT c.id AS cart_id, c.quantity, p.id AS product_id, p.title, p.description, p.price, p.image_url
      FROM CartItems c
      JOIN Products p ON c.product_id = p.id
      WHERE c.user_id = ?
      ORDER BY c.id DESC
    `;
    db.all(query, [userId], (err, dbItems) => {
      if (err) return callback(err, []);
      // If user also had session cart items prior to login, merge them
      const sessionCart = req.session.cart || [];
      if (sessionCart.length === 0) {
        return callback(null, dbItems || []);
      }
      return callback(null, dbItems || []);
    });
  } else {
    // Guest cart from session
    const sessionCart = (req.session && req.session.cart) ? req.session.cart : [];
    return callback(null, sessionCart);
  }
}

// GET /cart — View shopping bag (Accessible to everyone, no login required)
router.get('/', (req, res) => {
  getCartItems(req, (err, items) => {
    if (err) {
      return res.render('cart', {
        title: 'Shopping Bag | Bunonmela',
        items: [],
        subtotal: 0,
        error: 'Unable to load shopping bag.'
      });
    }

    const cartList = items || [];
    const subtotal = cartList.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);

    res.render('cart', {
      title: 'Shopping Bag | Bunonmela',
      items: cartList,
      subtotal,
      error: null
    });
  });
});

// GET /cart/count — JSON cart badge count for both guests & members
router.get('/count', (req, res) => {
  if (req.session && req.session.user) {
    db.get('SELECT SUM(quantity) AS count FROM CartItems WHERE user_id = ?', [req.session.user.id], (err, row) => {
      const count = row && row.count ? row.count : 0;
      res.json({ count });
    });
  } else {
    const sessionCart = (req.session && req.session.cart) ? req.session.cart : [];
    const count = sessionCart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    res.json({ count });
  }
});

// POST /cart/add — Add product to cart (Guest friendly, no forced login)
router.post('/add', (req, res) => {
  const productId = parseInt(req.body.productId || req.body.product_id, 10);
  const quantity = Math.max(1, parseInt(req.body.quantity || 1, 10));
  const isBuyNow = req.body.buyNow === 'true' || req.body.buyNow === true;

  if (!productId) {
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
      return res.status(400).json({ success: false, message: 'Invalid product ID.' });
    }
    return res.redirect('back');
  }

  // Fetch product from SQLite to get accurate title, price & image
  db.get('SELECT id, title, description, price, image_url FROM Products WHERE id = ?', [productId], (prodErr, product) => {
    if (prodErr || !product) {
      if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
        return res.status(404).json({ success: false, message: 'Product not found.' });
      }
      return res.redirect('/');
    }

    if (req.session && req.session.user) {
      // Logged-in user: save into SQLite CartItems
      const userId = req.session.user.id;
      db.get('SELECT id, quantity FROM CartItems WHERE user_id = ? AND product_id = ?', [userId, productId], (err, existing) => {
        if (err) {
          console.error('Cart DB error:', err.message);
          return res.status(500).json({ success: false, message: 'Database error.' });
        }

        const handleSuccess = () => {
          db.get('SELECT SUM(quantity) AS totalCount FROM CartItems WHERE user_id = ?', [userId], (cntErr, row) => {
            const totalCount = row && row.totalCount ? row.totalCount : 0;
            if (isBuyNow) {
              if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
                return res.json({ success: true, redirect: '/checkout', totalCount });
              }
              return res.redirect('/checkout');
            }
            if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
              return res.json({ success: true, message: 'Piece added to shopping bag.', totalCount });
            }
            res.redirect('/cart');
          });
        };

        if (existing) {
          db.run('UPDATE CartItems SET quantity = ? WHERE id = ?', [existing.quantity + quantity, existing.id], handleSuccess);
        } else {
          db.run('INSERT INTO CartItems (user_id, product_id, quantity) VALUES (?, ?, ?)', [userId, productId, quantity], handleSuccess);
        }
      });
    } else {
      // Guest: save into signed cookie session cart
      if (!req.session) req.session = {};
      if (!Array.isArray(req.session.cart)) req.session.cart = [];

      const existingIndex = req.session.cart.findIndex(i => Number(i.product_id) === Number(productId));
      if (existingIndex > -1) {
        req.session.cart[existingIndex].quantity = Number(req.session.cart[existingIndex].quantity || 0) + quantity;
      } else {
        req.session.cart.push({
          cart_id: 'guest_' + product.id,
          id: 'guest_' + product.id,
          product_id: product.id,
          title: product.title,
          description: product.description,
          price: product.price,
          image_url: product.image_url,
          quantity
        });
      }

      const totalCount = req.session.cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

      if (isBuyNow) {
        if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
          return res.json({ success: true, redirect: '/checkout', totalCount });
        }
        return res.redirect('/checkout');
      }

      if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
        return res.json({ success: true, message: 'Piece added to shopping bag.', totalCount });
      }
      res.redirect('/cart');
    }
  });
});

// POST /cart/update — Change quantity (handles both DB and session items)
router.post('/update', (req, res) => {
  const rawCartId = req.body.cartId;
  const quantity = parseInt(req.body.quantity, 10);

  if (!rawCartId || isNaN(quantity)) {
    return res.redirect('/cart');
  }

  if (req.session && req.session.user && !String(rawCartId).startsWith('guest_')) {
    const cartId = parseInt(rawCartId, 10);
    const userId = req.session.user.id;
    if (quantity <= 0) {
      db.run('DELETE FROM CartItems WHERE id = ? AND user_id = ?', [cartId, userId], () => res.redirect('/cart'));
    } else {
      db.run('UPDATE CartItems SET quantity = ? WHERE id = ? AND user_id = ?', [quantity, cartId, userId], () => res.redirect('/cart'));
    }
  } else {
    // Session guest cart update
    if (req.session && Array.isArray(req.session.cart)) {
      const idx = req.session.cart.findIndex(i => String(i.cart_id) === String(rawCartId) || String(i.product_id) === String(rawCartId));
      if (idx > -1) {
        if (quantity <= 0) {
          req.session.cart.splice(idx, 1);
        } else {
          req.session.cart[idx].quantity = quantity;
        }
      }
    }
    res.redirect('/cart');
  }
});

// POST /cart/remove — Remove an item from cart
router.post('/remove', (req, res) => {
  const rawCartId = req.body.cartId;

  if (req.session && req.session.user && !String(rawCartId).startsWith('guest_')) {
    const cartId = parseInt(rawCartId, 10);
    const userId = req.session.user.id;
    db.run('DELETE FROM CartItems WHERE id = ? AND user_id = ?', [cartId, userId], () => res.redirect('/cart'));
  } else {
    if (req.session && Array.isArray(req.session.cart)) {
      req.session.cart = req.session.cart.filter(i => String(i.cart_id) !== String(rawCartId) && String(i.product_id) !== String(rawCartId));
    }
    res.redirect('/cart');
  }
});

module.exports = router;
