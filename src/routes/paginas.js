const express = require('express');
const { requireLogin } = require('../middleware/auth');
const router = express.Router();

router.get('/',          requireLogin, (req, res) => res.sendFile('dashboard.html', { root: 'views' }));
router.get('/registro',  requireLogin, (req, res) => res.sendFile('registro.html',  { root: 'views' }));
router.get('/relatorio', requireLogin, (req, res) => res.sendFile('relatorio.html', { root: 'views' }));

module.exports = router;
