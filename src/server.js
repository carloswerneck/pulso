require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');
const { init } = require('./db/init');

const app = express();

const isProduction = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/', require('./routes/auth'));
app.use('/', require('./routes/paginas'));
app.use('/api/p/:token', require('./routes/apiPublica'));
app.use('/api', require('./routes/api'));

const PORT = process.env.PORT || 3000;

init()
  .then(() => {
    app.listen(PORT, () => console.log(`Pulso rodando em http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('Falha ao inicializar banco de dados:', err);
    process.exit(1);
  });
