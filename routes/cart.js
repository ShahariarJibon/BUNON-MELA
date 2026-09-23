const express = require('express');
const router = express.Router();
const db = require('../database/db');

// GET /cart — View shopping bag (Requires sign in / sign up)
router.get('/', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/auth/login?redirect=' + encodeURIComponent('/cart'));
  }

  const userId = req.session.user.id;
  const query = `
    SELECT c.id AS cart_id, c.quantity, p.id AS product_id, p.title, p.description, p.price, p.image_url
    FROM CartItems c
    JOIN Products p ON c.product_id = p.id
    WHERE c.user_id = ?
    ORDER BY c.id DESC
  `;
  db.all(query, [userId], (err, items) => {
    if (err) {
      return res.render('cart', {
        title: 'Shopping Bag | Bunonmela',
        items: [],
        subtotal: 0,
        error: 'Unable to load shopping bag.'
      });
    }

    const subtotal = (items || []).reduce((sum, item) => sum + (item.price * item.quantity), 0);

    res.render('cart', {
      title: 'Shopping Bag | Bunonmela',
      items: items || [],
      subtotal,
      error: null
    });
  });
});

// GET /cart/count — JSON cart badge count
router.get('/count', (req, res) => {
  if (req.session && req.session.user) {
    db.get('SELECT SUM(quantity) AS count FROM CartItems WHERE user_id = ?', [req.session.user.id], (err, row) => {
      const count = row && row.count ? row.count : 0;
      res.json({ count });
    });
  } else {
    res.json({ count: 0 });
  }
});

// POST /cart/add — Add product to cart (Strictly requires sign in / sign up)
router.post('/add', (req, res) => {
  const productId = parseInt(req.body.productId || req.body.product_id, 10);
  const quantity = Math.max(1, parseInt(req.body.quantity || 1, 10));
  const isBuyNow = req.body.buyNow === 'true' || req.body.buyNow === true;

  if (!productId) {
    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.status(400).json({ success: false, message: 'Invalid product ID.' });
    }
    return res.redirect('back');
  }

  // Require user authentication
  if (!req.session || !req.session.user) {
    const returnUrl = req.get('Referrer') || `/products/${productId}`;
    const redirectTarget = isBuyNow
      ? `/auth/login?redirect=${encodeURIComponent('/checkout')}&action=buy_now&productId=${productId}&quantity=${quantity}`
      : `/auth/login?redirect=${encodeURIComponent(returnUrl)}&action=add_cart&productId=${productId}&quantity=${quantity}`;

    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.status(401).json({
        success: false,
        requireAuth: true,
        redirect: redirectTarget
      });
    }
    return res.redirect(redirectTarget);
  }

  // User is logged in: Check product and save to SQLite
  db.get('SELECT id, title, price, image_url FROM Products WHERE id = ?', [productId], (prodErr, product) => {
    if (prodErr || !product) {
      if (req.xhr || req.headers.accept?.includes('json')) {
        return res.status(404).json({ success: false, message: 'Product not found.' });
      }
      return res.redirect('/');
    }

    const userId = req.session.user.id;
    db.get('SELECT id, quantity FROM CartItems WHERE user_id = ? AND product_id = ?', [userId, productId], (err, existing) => {
      if (err) {
        console.error('Cart DB error:', err.message);
        return res.status(500).json({ success: false, message: 'Database error.' });
      }

      if (existing) {
        db.run('UPDATE CartItems SET quantity = ? WHERE id = ?', [existing.quantity + quantity, existing.id], () => {
          finishResponse();
        });
      } else {
        db.run('INSERT INTO CartItems (user_id, product_id, quantity) VALUES (?, ?, ?)', [userId, productId, quantity], () => {
          finishResponse();
        });
      }

      function finishResponse() {
        db.get('SELECT SUM(quantity) AS totalCount FROM CartItems WHERE user_id = ?', [userId], (cntErr, row) => {
          const totalCount = row && row.totalCount ? row.totalCount : 0;
          if (isBuyNow) {
            if (req.xhr || req.headers.accept?.includes('json')) {
              return res.json({ success: true, redirect: '/checkout', totalCount });
            }
            return res.redirect('/checkout');
          }
          if (req.xhr || req.headers.accept?.includes('json')) {
            return res.json({ success: true, message: 'Piece added to shopping bag.', totalCount });
          }
          res.redirect('/cart');
        });
      }
    });
  });
});

// POST /cart/update — Change quantity for user in SQLite
router.post('/update', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/auth/login');
  }

  const cartId = parseInt(req.body.cartId, 10);
  const quantity = parseInt(req.body.quantity, 10);
  const userId = req.session.user.id;

  if (!cartId || isNaN(quantity)) {
    return res.redirect('/cart');
  }

  if (quantity <= 0) {
    db.run('DELETE FROM CartItems WHERE id = ? AND user_id = ?', [cartId, userId], () => {
      res.redirect('/cart');
    });
  } else {
    db.run('UPDATE CartItems SET quantity = ? WHERE id = ? AND user_id = ?', [quantity, cartId, userId], () => {
      res.redirect('/cart');
    });
  }
});

// POST /cart/remove — Remove an item from user cart in SQLite
router.post('/remove', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.redirect('/auth/login');
  }

  const cartId = parseInt(req.body.cartId, 10);
  const userId = req.session.user.id;

  db.run('DELETE FROM CartItems WHERE id = ? AND user_id = ?', [cartId, userId], (err) => {
    res.redirect('/cart');
  });
});

module.exports = router;
