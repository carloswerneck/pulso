const express = require('express');
const { requireLogin } = require('../middleware/auth');
const router = express.Router();

router.get('/',          requireLogin, (req, res) => res.sendFile('dashboard.html',        { root: 'views' }));
router.get('/registro',  requireLogin, (req, res) => res.sendFile('registro.html',         { root: 'views' }));
router.get('/relatorio', requireLogin, (req, res) => res.sendFile('relatorio.html',        { root: 'views' }));
router.get('/docs',      requireLogin, (req, res) => res.sendFile('docs.html',             { root: 'views' }));

// Relatório público — sem login, autenticado apenas pelo token na URL
router.get('/p/:token', (req, res) => {
  const token = process.env.PUBLIC_TOKEN;
  if (!token || req.params.token !== token) {
    return res.status(404).send('Link inválido ou desabilitado.');
  }
  res.sendFile('relatorio-publico.html', { root: 'views' });
});

module.exports = router;
