const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session && req.session.autenticado) return res.redirect('/');
  res.sendFile('login.html', { root: 'views' });
});

router.post('/login', async (req, res) => {
  const { usuario, senha } = req.body;
  const userOk = usuario === process.env.AUTH_USER;
  const senhaHash = process.env.AUTH_PASSWORD_HASH || '';

  let senhaOk = false;
  try {
    senhaOk = await bcrypt.compare(senha || '', senhaHash);
  } catch (_) {}

  if (!userOk || !senhaOk) {
    return res.status(401).sendFile('login.html', { root: 'views', headers: { 'x-login-erro': '1' } });
  }

  req.session.autenticado = true;
  req.session.usuario = usuario;
  res.redirect('/');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
