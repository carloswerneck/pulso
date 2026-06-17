function requireLogin(req, res, next) {
  if (req.session && req.session.autenticado) return next();
  res.redirect('/login');
}

module.exports = { requireLogin };
