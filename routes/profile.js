const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Middleware: Require logged in user for profile
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/auth/login?redirect=' + encodeURIComponent('/profile'));
}

// GET /profile — Customer Profile with Order Statistics & History
router.get('/', requireAuth, (req, res) => {
  const userId = req.session.user.id;

  // 1. Fetch user profile
  db.get('SELECT id, name, email, phone, role, created_at FROM Users WHERE id = ?', [userId], (userErr, user) => {
    if (userErr || !user) {
      return res.redirect('/auth/login');
    }

    // 2. Fetch all orders for this user
    const ordersSql = `SELECT * FROM Orders WHERE user_id = ? ORDER BY id DESC`;
    db.all(ordersSql, [userId], (ordersErr, ordersList) => {
      const orders = ordersList || [];

      // 3. Fetch all line items for user's orders
      const itemsSql = `
        SELECT oi.*, p.image_url
        FROM OrderItems oi
        JOIN Orders o ON oi.order_id = o.id
        LEFT JOIN Products p ON oi.product_id = p.id
        WHERE o.user_id = ?
        ORDER BY oi.id ASC
      `;
      db.all(itemsSql, [userId], (itemsErr, allItems) => {
        const items = allItems || [];

        // Attach items to each order
        orders.forEach(order => {
          order.items = items.filter(i => i.order_id === order.id);
        });

        // 4. Calculate current order statistics
        const stats = {
          totalOrders: orders.length,
          pendingOrders: orders.filter(o => o.status === 'Pending').length,
          activeOrders: orders.filter(o => o.status === 'Pending' || o.status === 'Approved' || o.status === 'Confirmed' || o.status === 'Dispatched').length,
          deliveredOrders: orders.filter(o => o.status === 'Delivered').length,
          totalSpent: orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)
        };

        res.render('profile', {
          title: 'My Bespoke Profile & Orders | Bunonmela',
          user,
          orders,
          stats
        });
      });
    });
  });
});

module.exports = router;
