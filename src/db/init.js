const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(process.env.DB_PATH || './data/pressao.db');
let _db = null;

function getDb() {
  if (!_db) throw new Error('Banco não inicializado — chame init() antes');
  return _db;
}

function save() {
  const data = _db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

async function init() {
  const SQL = await initSqlJs();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(dbPath)) {
    _db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    _db = new SQL.Database();
  }

  _db.run(`
    CREATE TABLE IF NOT EXISTS medicoes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      sistolica  INTEGER NOT NULL,
      diastolica INTEGER NOT NULL,
      bpm        INTEGER,
      medido_em  TEXT NOT NULL,
      observacao TEXT,
      origem     TEXT NOT NULL DEFAULT 'manual',
      criado_em  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  _db.run(`CREATE INDEX IF NOT EXISTS idx_medicoes_medido_em ON medicoes(medido_em)`);
  save();
}

module.exports = { init, getDb, save };
