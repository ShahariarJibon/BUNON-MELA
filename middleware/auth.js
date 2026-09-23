// Authentication middleware

// Makes currentUser available in customer EJS templates (strictly customer accounts only)
function setLocals(req, res, next) {
  // Only regular customer accounts are exposed as currentUser on customer-facing pages
  // Admin credentials are strictly segregated and NEVER leak to customer navbar or views
  res.locals.currentUser = (req.session && req.session.user && req.session.user.role !== 'admin') ? req.session.user : null;
  res.locals.adminUser = (req.session && req.session.adminUser && req.session.adminUser.role === 'admin') ? req.session.adminUser : null;
  next();
}

// Requires logged-in customer user
function requireLogin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role !== 'admin') {
    return next();
  }
  const redirectUrl = req.originalUrl || '/';
  if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
    return res.status(401).json({ error: 'Authentication required', redirect: '/auth/login?redirect=' + encodeURIComponent(redirectUrl) });
  }
  res.redirect('/auth/login?redirect=' + encodeURIComponent(redirectUrl));
}

// Requires admin role (strictly protected)
function requireAdmin(req, res, next) {
  if (req.session && req.session.adminUser && req.session.adminUser.role === 'admin') {
    res.locals.adminUser = req.session.adminUser;
    return next();
  }
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    req.session.adminUser = req.session.user;
    delete req.session.user;
    res.locals.adminUser = req.session.adminUser;
    return next();
  }
  if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
    return res.status(401).json({ error: 'Admin access required', redirect: '/auth/login?redirect=' + encodeURIComponent('/admin') });
  }
  res.redirect('/auth/login?redirect=' + encodeURIComponent('/admin'));
}

module.exports = { setLocals, requireLogin, requireAdmin };
