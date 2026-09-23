const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database/db');

// Helper to migrate session cart into SQLite CartItems upon login/signup
function syncSessionCartToDb(userId, req, callback) {
  if (!req.session || !req.session.cart || req.session.cart.length === 0) {
    return callback();
  }
  const items = [...req.session.cart];
  req.session.cart = [];

  let pending = items.length;
  items.forEach(item => {
    db.get('SELECT id, quantity FROM CartItems WHERE user_id = ? AND product_id = ?', [userId, item.product_id], (err, existing) => {
      if (!err && existing) {
        db.run('UPDATE CartItems SET quantity = ? WHERE id = ?', [existing.quantity + item.quantity, existing.id], () => {
          if (--pending === 0) callback();
        });
      } else {
        db.run('INSERT INTO CartItems (user_id, product_id, quantity) VALUES (?, ?, ?)', [userId, item.product_id, item.quantity], () => {
          if (--pending === 0) callback();
        });
      }
    });
  });
}

// Helper to handle post-login/signup cart action
function handlePostAuthAction(userId, req, res, fallbackRedirect) {
  let redirectUrl = req.body.redirect || req.query.redirect || fallbackRedirect || '/';
  const action = req.body.action || req.query.action;
  const productId = parseInt(req.body.productId || req.query.productId, 10);
  const quantity = Math.max(1, parseInt(req.body.quantity || req.query.quantity || 1, 10));

  // Security guard: If target redirect is /admin, ensure user is actually an administrator
  if (redirectUrl.startsWith('/admin')) {
    const hasAdmin = (req.session && req.session.adminUser) ||
                     (req.session && req.session.user && req.session.user.role === 'admin');
    if (!hasAdmin) {
      redirectUrl = '/';
    }
  }

  syncSessionCartToDb(userId, req, () => {
    if ((action === 'add_cart' || action === 'buy_now') && productId) {
      db.get('SELECT id, quantity FROM CartItems WHERE user_id = ? AND product_id = ?', [userId, productId], (err, existing) => {
        if (!err && existing) {
          db.run('UPDATE CartItems SET quantity = ? WHERE id = ?', [existing.quantity + quantity, existing.id], () => {
            if (action === 'buy_now') return res.redirect('/checkout');
            return res.redirect(redirectUrl);
          });
        } else {
          db.run('INSERT INTO CartItems (user_id, product_id, quantity) VALUES (?, ?, ?)', [userId, productId, quantity], () => {
            if (action === 'buy_now') return res.redirect('/checkout');
            return res.redirect(redirectUrl);
          });
        }
      });
    } else {
      res.redirect(redirectUrl);
    }
  });
}

// GET /auth/login
router.get('/login', (req, res) => {
  const redirect = req.query.redirect || '';
  const action = req.query.action || '';
  const productId = req.query.productId || '';
  const quantity = req.query.quantity || '1';

  // If redirect requires admin:
  if (redirect.startsWith('/admin')) {
    // If already authenticated as admin, go directly to /admin
    if ((req.session && req.session.adminUser) || (req.session && req.session.user && req.session.user.role === 'admin')) {
      return res.redirect('/admin');
    }
    // If currently logged in as a customer, DO NOT AUTO-REDIRECT to /admin (which causes infinite loop!)
    // Instead, display the admin login page so they can sign in as an admin
    return res.render('auth/login', {
      title: 'Admin Sign In | Bunonmela',
      error: (req.session && req.session.user) ? `You are currently signed in as "${req.session.user.name}" (${req.session.user.email}). Administrator credentials are required to access the Admin Panel.` : null,
      redirect,
      action,
      productId,
      quantity
    });
  }

  if (req.session && req.session.user) {
    return handlePostAuthAction(req.session.user.id, req, res, '/');
  }

  res.render('auth/login', {
    title: 'Sign In | Bunonmela',
    error: null,
    redirect,
    action,
    productId,
    quantity
  });
});

// POST /auth/login
router.post('/login', (req, res) => {
  const { email, password, redirect, action, productId, quantity } = req.body;

  if (!email || !password) {
    return res.render('auth/login', {
      title: 'Sign In | Bunonmela',
      error: 'Please enter your mobile number (or email) and password.',
      redirect: redirect || '',
      action: action || '',
      productId: productId || '',
      quantity: quantity || '1'
    });
  }

  const identifier = (email || '').trim().toLowerCase();
  let cleanPhone = identifier.replace(/[\s\-\(\)]/g, '');
  if (cleanPhone.startsWith('+88')) cleanPhone = cleanPhone.slice(3);
  if (cleanPhone.startsWith('88')) cleanPhone = cleanPhone.slice(2);

  db.get(
    'SELECT * FROM Users WHERE email = ? OR phone = ? OR phone = ?',
    [identifier, identifier, cleanPhone],
    async (err, user) => {
      if (err || !user) {
        return res.render('auth/login', {
          title: 'Sign In | Bunonmela',
          error: 'Invalid credentials. Please verify your mobile number/email and password.',
          redirect: redirect || '',
          action: action || '',
          productId: productId || '',
          quantity: quantity || '1'
        });
      }

      try {
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
          return res.render('auth/login', {
            title: 'Sign In | Bunonmela',
            error: 'Invalid password. Please try again.',
            redirect: redirect || '',
            action: action || '',
            productId: productId || '',
            quantity: quantity || '1'
          });
        }

        // If user is admin
        if (user.role === 'admin') {
          req.session.adminUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone || null,
            role: 'admin'
          };
          req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone || null,
            role: 'admin'
          };
          const dest = (redirect && redirect.startsWith('/admin')) ? redirect : '/admin';
          return res.redirect(dest);
        }

        // If user is customer
        req.session.user = {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone || null,
          role: user.role
        };

        let safeRedirect = redirect;
        if (safeRedirect && safeRedirect.startsWith('/admin')) {
          safeRedirect = '/';
        }

        handlePostAuthAction(user.id, req, res, safeRedirect || '/');
      } catch (e) {
        res.render('auth/login', {
          title: 'Sign In | Bunonmela',
          error: 'Server error. Please try again.',
          redirect: redirect || '',
          action: action || '',
          productId: productId || '',
          quantity: quantity || '1'
        });
      }
    }
  );
});

// GET /auth/signup
router.get('/signup', (req, res) => {
  const redirect = req.query.redirect || '';
  const action = req.query.action || '';
  const productId = req.query.productId || '';
  const quantity = req.query.quantity || '1';

  if (redirect.startsWith('/admin')) {
    return res.redirect('/auth/login?redirect=' + encodeURIComponent('/admin'));
  }

  if (req.session && req.session.user) {
    return handlePostAuthAction(req.session.user.id, req, res, '/');
  }

  res.render('auth/signup', {
    title: 'Create Account | Bunonmela',
    error: null,
    redirect,
    action,
    productId,
    quantity
  });
});

// POST /auth/signup (Mobile-first account creation, email is optional)
router.post('/signup', async (req, res) => {
  const { name, phone, email, password, confirmPassword, redirect, action, productId, quantity } = req.body;

  const renderError = (msg) => {
    return res.render('auth/signup', {
      title: 'Create Account | Bunonmela',
      error: msg,
      redirect: redirect || '',
      action: action || '',
      productId: productId || '',
      quantity: quantity || '1'
    });
  };

  if (!name || !phone || !password) {
    return renderError('Name, mobile number, and password are required.');
  }

  // Validate 11-digit BD mobile
  let cleanPhone = (phone || '').trim().replace(/[\s\-\(\)]/g, '');
  if (cleanPhone.startsWith('+88')) cleanPhone = cleanPhone.slice(3);
  if (cleanPhone.startsWith('88')) cleanPhone = cleanPhone.slice(2);
  const bdPhoneRegex = /^01[3-9]\d{8}$/;
  if (!bdPhoneRegex.test(cleanPhone)) {
    return renderError('Please enter a valid 11-digit Bangladeshi mobile number (013-019).');
  }

  if (password !== confirmPassword) {
    return renderError('Passwords do not match.');
  }

  if (password.length < 6) {
    return renderError('Password must be at least 6 characters.');
  }

  // Check if mobile number already exists in SQLite
  db.get('SELECT id FROM Users WHERE phone = ?', [cleanPhone], async (err, existingPhone) => {
    if (existingPhone) {
      return renderError('An account with this mobile number already exists. Please sign in.');
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    const finalEmail = cleanEmail || `${cleanPhone}@bunonmela.customer`;

    // Check if email already used
    db.get('SELECT id FROM Users WHERE email = ?', [finalEmail], async (eErr, existingEmail) => {
      if (existingEmail && cleanEmail) {
        return renderError('An account with this email address already exists. Please sign in or use another email.');
      }

      try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(
          'INSERT INTO Users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)',
          [name.trim(), finalEmail, cleanPhone, hashedPassword, 'customer'],
          function (insErr) {
            if (insErr) {
              return renderError('Could not create account. Please try again.');
            }

            const newUserId = this.lastID;

            // Auto-login after signup
            req.session.user = {
              id: newUserId,
              name: name.trim(),
              phone: cleanPhone,
              email: finalEmail,
              role: 'customer'
            };

            handlePostAuthAction(newUserId, req, res, '/');
          }
        );
      } catch (e) {
        renderError('Server error. Please try again.');
      }
    });
  });
});

// GET /auth/logout
router.get('/logout', (req, res) => {
  if (req.session && typeof req.session.destroy === 'function') {
    req.session.destroy(() => {
      res.redirect('/');
    });
  } else {
    req.session = null;
    res.redirect('/');
  }
});

module.exports = router;
