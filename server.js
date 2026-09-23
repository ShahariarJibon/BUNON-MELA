const express = require('express');
const path = require('path');
const cookieSession = require('cookie-session');
const { setLocals } = require('./middleware/auth');

// Initialize database on boot
require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust reverse proxy (essential for Vercel and secure cookies)
app.set('trust proxy', 1);

// Security hardening
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Stateless cookie-session: preserves sessions across serverless invocations
app.use(cookieSession({
  name: 'bunonmela_session',
  keys: [process.env.SESSION_SECRET || 'bunonmela-luxury-secret-2026', 'bunonmela-luxury-key-alt'],
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  sameSite: 'lax',
  httpOnly: true
}));

// Express-session compatibility helpers for cookie-session
app.use((req, res, next) => {
  if (req.session) {
    if (!req.session.save) {
      req.session.save = (cb) => { if (cb) cb(); };
    }
    if (!req.session.destroy) {
      req.session.destroy = (cb) => {
        req.session = null;
        if (cb) cb();
      };
    }
  }
  next();
});

// Make currentUser available in all views
app.use(setLocals);

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/cart', require('./routes/cart'));
app.use('/checkout', require('./routes/checkout'));
app.use('/profile', require('./routes/profile'));
app.use('/admin', require('./routes/admin'));

// 404
app.use((req, res) => {
  res.status(404).render('home', {
    title: '404 | Bunonmela',
    products: [],
    categories: [],
    error: 'Page not found.'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(500).send('Internal Server Error');
});

if (require.main === module || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log('════════════════════════════════════════════');
    console.log(`💎 BUNONMELA v2.0 — LUXURY BOUTIQUE`);
    console.log(`🌐 Storefront:  http://localhost:${PORT}`);
    console.log(`👑 Admin:       http://localhost:${PORT}/admin`);
    console.log(`🔐 Login:       http://localhost:${PORT}/auth/login`);
    console.log('════════════════════════════════════════════');
  });
}

module.exports = app;
