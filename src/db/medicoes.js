const { getDb, save } = require('./init');

function query(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function inserir({ sistolica, diastolica, bpm, medido_em, observacao, origem }) {
  const db = getDb();
  db.run(
    `INSERT INTO medicoes (sistolica, diastolica, bpm, medido_em, observacao, origem)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sistolica, diastolica, bpm ?? null, medido_em, observacao ?? null, origem ?? 'manual']
  );
  const id = query('SELECT last_insert_rowid() AS id')[0].id;
  save();
  return buscarPorId(id);
}

function buscarPorId(id) {
  return query('SELECT * FROM medicoes WHERE id = ?', [id])[0];
}

function listarPorPeriodo(inicio, fim) {
  return query(
    'SELECT * FROM medicoes WHERE medido_em >= ? AND medido_em <= ? ORDER BY medido_em ASC',
    [inicio, fim]
  );
}

function resumoPorPeriodo(inicio, fim) {
  const agg = query(`
    SELECT
      ROUND(AVG(sistolica))  AS media_sistolica,
      ROUND(AVG(diastolica)) AS media_diastolica,
      ROUND(AVG(bpm))        AS media_bpm,
      COUNT(*)               AS total_medicoes
    FROM medicoes
    WHERE medido_em >= ? AND medido_em <= ?
  `, [inicio, fim])[0];

  const ultima = query(`
    SELECT * FROM medicoes
    WHERE medido_em >= ? AND medido_em <= ?
    ORDER BY medido_em DESC LIMIT 1
  `, [inicio, fim])[0];

  return { ...agg, ultima };
}

function excluir(id) {
  const exists = buscarPorId(id);
  if (!exists) return false;
  getDb().run('DELETE FROM medicoes WHERE id = ?', [id]);
  save();
  return true;
}

module.exports = { inserir, buscarPorId, listarPorPeriodo, resumoPorPeriodo, excluir };
