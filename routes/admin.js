const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../database/db');
const { requireAdmin } = require('../middleware/auth');

// Multer config for product image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../public/uploads')),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  }
});

// All admin routes require admin role
router.use(requireAdmin);

// GET /admin — Dashboard with Customer Pagination, Categories Management & Products
router.get('/', (req, res) => {
  const stats = { productCount: 0, customerCount: 0, totalValue: 0 };
  const userPage = Math.max(1, parseInt(req.query.userPage || 1, 10));
  const userLimit = 10;
  const userOffset = (userPage - 1) * userLimit;

  // 1. Stats: Products count and total value
  db.get('SELECT COUNT(*) as count, SUM(price) as totalVal FROM Products', (err, prodRow) => {
    if (!err && prodRow) {
      stats.productCount = prodRow.count || 0;
      stats.totalValue = prodRow.totalVal || 0;
    }

    // 2. Stats & count of customers ONLY (no admin)
    db.get('SELECT COUNT(*) as count FROM Users WHERE role != "admin"', (err, userRow) => {
      const totalCustomers = (!err && userRow) ? (userRow.count || 0) : 0;
      stats.customerCount = totalCustomers;
      const totalUserPages = Math.max(1, Math.ceil(totalCustomers / userLimit));

      // 3. Categories list from Categories table
      db.all('SELECT id, name FROM Categories ORDER BY name ASC', [], (catErr, categoryRows) => {
        let categories = categoryRows || [];
        if (categories.length === 0) {
          // Fallback defaults
          categories = [
            { id: 1, name: 'Decorated Bags' },
            { id: 2, name: 'Decorated Parts' },
            { id: 3, name: 'Decorated Nose Pin' },
            { id: 4, name: 'Decorated Hair Clip' },
            { id: 5, name: 'Silk Sarees' },
            { id: 6, name: 'Haute Couture' }
          ];
        }

        // 4. Products list (all products for management)
        db.all('SELECT * FROM Products ORDER BY id DESC', [], (err, products) => {
          // 5. Orders list (all customer orders with items)
          db.all('SELECT * FROM Orders ORDER BY id DESC', [], (orderErr, orders) => {
            // 6. Coupons list (all active promo codes for free delivery)
            db.all('SELECT * FROM Coupons ORDER BY id DESC', [], (couponErr, coupons) => {
              // 7. Customers pagination (10 per page, excluding admin)
              db.all(
                'SELECT id, name, email, role, created_at FROM Users WHERE role != "admin" ORDER BY id DESC LIMIT ? OFFSET ?',
                [userLimit, userOffset],
                (err, users) => {
                  res.render('admin', {
                    title: 'Admin Dashboard | Bunonmela',
                    stats: {
                      ...stats,
                      orderCount: (orders || []).length,
                      pendingOrderCount: (orders || []).filter(o => o.status === 'Pending').length,
                      couponCount: (coupons || []).length
                    },
                    products: products || [],
                    orders: orders || [],
                    users: users || [],
                    coupons: coupons || [],
                    categories,
                    userPagination: {
                      currentPage: userPage,
                      totalPages: totalUserPages,
                      totalCount: totalCustomers,
                      limit: userLimit
                    }
                  });
                }
              );
            });
          });
        });
      });
    });
  });
});

// POST /admin/categories/add — Add new category in dedicated category section
router.post('/categories/add', (req, res) => {
  const categoryName = (req.body.name || '').trim();
  const isJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));

  if (!categoryName) {
    if (isJson) return res.status(400).json({ success: false, error: 'Category name cannot be empty.' });
    return res.redirect('/admin#categories-section');
  }

  db.run('INSERT OR IGNORE INTO Categories (name) VALUES (?)', [categoryName], function (err) {
    if (err) {
      console.error('Error adding category:', err.message);
      if (isJson) return res.status(500).json({ success: false, error: err.message });
      return res.redirect('/admin#categories-section');
    }
    // Fetch the inserted or existing category id
    db.get('SELECT id, name FROM Categories WHERE name = ?', [categoryName], (fetchErr, row) => {
      if (isJson) {
        return res.json({ success: true, id: row ? row.id : null, name: categoryName });
      }
      res.redirect('/admin#categories-section');
    });
  });
});

// POST /admin/categories/delete/:id — Remove category from dedicated category section
router.post('/categories/delete/:id', (req, res) => {
  const catId = req.params.id;
  const isJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));

  db.run('DELETE FROM Categories WHERE id = ?', [catId], (err) => {
    if (err) console.error('Error deleting category:', err.message);
    if (isJson) {
      return res.json({ success: !err, id: catId });
    }
    res.redirect('/admin#categories-section');
  });
});

// POST /admin/products/add — Add new product
router.post('/products/add', upload.single('image'), (req, res) => {
  let { title, category, description, price } = req.body;
  let image_url = 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80';

  if (req.file) {
    image_url = '/uploads/' + req.file.filename;
  } else if (req.body.custom_image_url) {
    image_url = req.body.custom_image_url.trim();
  }

  const cleanCategory = (category || 'Decorated Bags').trim();

  // Ensure category is in Categories table as well
  db.run('INSERT OR IGNORE INTO Categories (name) VALUES (?)', [cleanCategory], () => {});

  db.run(
    'INSERT INTO Products (title, category, description, price, image_url) VALUES (?, ?, ?, ?, ?)',
    [title.trim(), cleanCategory, (description || '').trim(), parseFloat(price) || 0, image_url],
    (err) => {
      if (err) console.error('Error adding product:', err.message);
      res.redirect('/admin#products-section');
    }
  );
});

// POST /admin/products/edit/:id — Edit existing product & category
router.post('/products/edit/:id', upload.single('image'), (req, res) => {
  const productId = req.params.id;
  let { title, category, description, price } = req.body;
  const cleanCategory = (category || 'Decorated Bags').trim();

  // Ensure category is in Categories table
  db.run('INSERT OR IGNORE INTO Categories (name) VALUES (?)', [cleanCategory], () => {});

  if (req.file) {
    const image_url = '/uploads/' + req.file.filename;
    db.run(
      'UPDATE Products SET title = ?, category = ?, description = ?, price = ?, image_url = ? WHERE id = ?',
      [title.trim(), cleanCategory, (description || '').trim(), parseFloat(price) || 0, image_url, productId],
      (err) => {
        if (err) console.error('Error updating product with image:', err.message);
        res.redirect('/admin#products-section');
      }
    );
  } else {
    db.run(
      'UPDATE Products SET title = ?, category = ?, description = ?, price = ? WHERE id = ?',
      [title.trim(), cleanCategory, (description || '').trim(), parseFloat(price) || 0, productId],
      (err) => {
        if (err) console.error('Error updating product:', err.message);
        res.redirect('/admin#products-section');
      }
    );
  }
});

// POST /admin/products/delete/:id
router.post('/products/delete/:id', (req, res) => {
  const isJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
  db.run('DELETE FROM Products WHERE id = ?', [req.params.id], (err) => {
    if (err) console.error('Error deleting product:', err.message);
    if (isJson) {
      return res.json({ success: !err, id: req.params.id });
    }
    res.redirect('/admin#products-section');
  });
});

// POST /admin/orders/status/:id — Update order verification status
router.post('/orders/status/:id', (req, res) => {
  const orderId = req.params.id;
  const status = (req.body.status || '').trim();
  const allowed = ['Pending', 'Approved', 'Confirmed', 'Dispatched', 'Delivered', 'Cancelled'];

  if (allowed.includes(status)) {
    db.run('UPDATE Orders SET status = ? WHERE id = ?', [status, orderId], (err) => {
      if (err) console.error('Error updating order status:', err.message);
      res.redirect('/admin#orders-section');
    });
  } else {
    res.redirect('/admin#orders-section');
  }
});

// GET /admin/users/search?q=... — Search customers by name or email (JSON API)
router.get('/users/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res.json({ success: true, users: [] });
  }
  const searchPattern = `%${q}%`;
  db.all(
    'SELECT id, name, email, role, created_at FROM Users WHERE role != "admin" AND (name LIKE ? OR email LIKE ?) ORDER BY id DESC LIMIT 50',
    [searchPattern, searchPattern],
    (err, users) => {
      if (err) {
        console.error('Error searching users:', err.message);
        return res.status(500).json({ success: false, error: err.message });
      }
      res.json({ success: true, users: users || [] });
    }
  );
});

// POST /admin/users/delete/:id — Delete a customer account
router.post('/users/delete/:id', (req, res) => {
  const userId = req.params.id;
  const isJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));

  db.run('DELETE FROM Users WHERE id = ? AND role != "admin"', [userId], function (err) {
    if (err) console.error('Error deleting user:', err.message);
    if (isJson) {
      return res.json({ success: !err, id: userId, deleted: this.changes > 0 });
    }
    res.redirect('/admin#users-section');
  });
});

// POST /admin/coupons/add — Add new promotional coupon code for free delivery
router.post('/coupons/add', (req, res) => {
  const code = (req.body.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  const isJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));

  if (!code) {
    if (isJson) return res.status(400).json({ success: false, error: 'Coupon code cannot be empty.' });
    return req.session.save(() => res.redirect('/admin#coupons-section'));
  }

  db.run('INSERT OR IGNORE INTO Coupons (code) VALUES (?)', [code], function (err) {
    if (err) console.error('Error adding coupon:', err.message);
    if (isJson) {
      return res.json({ success: !err, id: this ? this.lastID : null, code });
    }
    req.session.save(() => {
      res.redirect('/admin#coupons-section');
    });
  });
});

// POST /admin/coupons/delete/:id — Delete coupon code
router.post('/coupons/delete/:id', (req, res) => {
  const couponId = req.params.id;
  const isJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));

  db.run('DELETE FROM Coupons WHERE id = ?', [couponId], function (err) {
    if (err) console.error('Error deleting coupon:', err.message);
    if (isJson) {
      return res.json({ success: !err, id: couponId });
    }
    req.session.save(() => {
      res.redirect('/admin#coupons-section');
    });
  });
});

module.exports = router;
