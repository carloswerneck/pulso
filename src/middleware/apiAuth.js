function requireApiAuth(req, res, next) {
  if (req.session && req.session.autenticado) return next();

  const apiKey = req.headers['x-api-key'];
  if (apiKey && apiKey === process.env.API_KEY) return next();

  res.status(401).json({ erro: 'Não autorizado. Forneça um cookie de sessão válido ou o header x-api-key.' });
}

module.exports = { requireApiAuth };
