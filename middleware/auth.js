// Authentication middleware

// Makes currentUser available in all EJS templates
function setLocals(req, res, next) {
  res.locals.currentUser = req.session ? (req.session.user || req.session.adminUser || null) : null;
  res.locals.adminUser = req.session ? req.session.adminUser : null;
  next();
}

// Requires any logged-in user
function requireLogin(req, res, next) {
  if (req.session && (req.session.user || req.session.adminUser)) {
    return next();
  }
  const redirectUrl = req.originalUrl || '/';
  if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
    return res.status(401).json({ error: 'Authentication required', redirect: '/auth/login?redirect=' + encodeURIComponent(redirectUrl) });
  }
  res.redirect('/auth/login?redirect=' + encodeURIComponent(redirectUrl));
}

// Requires admin role (strictly protected; preserves admin session)
function requireAdmin(req, res, next) {
  if (req.session) {
    if (req.session.adminUser) {
      res.locals.currentUser = req.session.adminUser;
      res.locals.adminUser = req.session.adminUser;
      return next();
    }
    if (req.session.user && req.session.user.role === 'admin') {
      req.session.adminUser = req.session.user;
      res.locals.currentUser = req.session.adminUser;
      res.locals.adminUser = req.session.adminUser;
      return next();
    }
  }
  if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
    return res.status(401).json({ error: 'Admin access required', redirect: '/auth/login?redirect=' + encodeURIComponent('/admin') });
  }
  res.redirect('/auth/login?redirect=' + encodeURIComponent('/admin'));
}

module.exports = { setLocals, requireLogin, requireAdmin };
