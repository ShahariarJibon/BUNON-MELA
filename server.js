const express = require('express');
const path = require('path');
const session = require('express-session');
const { setLocals } = require('./middleware/auth');

// Initialize database on boot
require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: 'bunonmela-luxury-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true
  }
}));

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

app.listen(PORT, () => {
  console.log('════════════════════════════════════════════');
  console.log(`💎 BUNONMELA v2.0 — LUXURY BOUTIQUE`);
  console.log(`🌐 Storefront:  http://localhost:${PORT}`);
  console.log(`👑 Admin:       http://localhost:${PORT}/admin`);
  console.log(`🔐 Login:       http://localhost:${PORT}/auth/login`);
  console.log('════════════════════════════════════════════');
});
