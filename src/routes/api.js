const express = require('express');
const PDFDocument = require('pdfkit');
const { requireApiAuth } = require('../middleware/apiAuth');
const { inserir, listarPorPeriodo, resumoPorPeriodo, excluir } = require('../db/medicoes');
const { classificar } = require('../lib/classificacao');
const { resolverPeriodo } = require('../lib/periodo');

const router = express.Router();
router.use(requireApiAuth);

function validar({ sistolica, diastolica, bpm }) {
  if (sistolica == null || !Number.isInteger(Number(sistolica)))
    return 'sistolica é obrigatória e deve ser um número inteiro';
  const s = Number(sistolica);
  if (s < 60 || s > 260)
    return 'sistolica deve ser um número entre 60 e 260';

  if (diastolica == null || !Number.isInteger(Number(diastolica)))
    return 'diastolica é obrigatória e deve ser um número inteiro';
  const d = Number(diastolica);
  if (d < 30 || d > 180)
    return 'diastolica deve ser um número entre 30 e 180';

  if (bpm != null) {
    if (!Number.isInteger(Number(bpm))) return 'bpm deve ser um número inteiro';
    const b = Number(bpm);
    if (b < 30 || b > 220) return 'bpm deve ser um número entre 30 e 220';
  }

  return null;
}

// POST /api/medicoes
router.post('/medicoes', (req, res) => {
  const { sistolica, diastolica, bpm, medido_em, observacao, origem } = req.body;

  const erro = validar({ sistolica, diastolica, bpm });
  if (erro) return res.status(400).json({ erro });

  const medidoEm = medido_em || new Date().toISOString().slice(0, 19);
  const medicao = inserir({
    sistolica: Number(sistolica),
    diastolica: Number(diastolica),
    bpm: bpm != null ? Number(bpm) : null,
    medido_em: medidoEm,
    observacao: observacao || null,
    origem: origem || 'manual',
  });

  const classificacao = classificar(medicao.sistolica, medicao.diastolica);
  res.status(201).json({ ...medicao, classificacao, alerta_crise: classificacao === 'crise' });
});

// GET /api/medicoes
router.get('/medicoes', (req, res) => {
  const { periodo, inicio, fim } = req.query;
  const p = resolverPeriodo(periodo, inicio, fim);
  const medicoes = listarPorPeriodo(p.inicio, p.fim).map(m => ({
    ...m,
    classificacao: classificar(m.sistolica, m.diastolica),
  }));
  res.json({ periodo: p.periodo || periodo, medicoes });
});

// GET /api/medicoes/resumo
router.get('/medicoes/resumo', (req, res) => {
  const { periodo, inicio, fim } = req.query;
  const p = resolverPeriodo(periodo, inicio, fim);
  const r = resumoPorPeriodo(p.inicio, p.fim);

  const ultimaMedicao = r.ultima
    ? { ...r.ultima, classificacao: classificar(r.ultima.sistolica, r.ultima.diastolica) }
    : null;

  const alertaCrise = ultimaMedicao?.classificacao === 'crise';

  res.json({
    periodo: p.periodo || periodo,
    media_sistolica: r.media_sistolica,
    media_diastolica: r.media_diastolica,
    media_bpm: r.media_bpm,
    total_medicoes: r.total_medicoes,
    ultima_medicao: ultimaMedicao,
    alerta_crise: alertaCrise,
  });
});

// GET /api/medicoes/pdf
router.get('/medicoes/pdf', (req, res) => {
  const { periodo, inicio, fim } = req.query;
  const p = resolverPeriodo(periodo, inicio, fim);
  const medicoes = listarPorPeriodo(p.inicio, p.fim);
  const r = resumoPorPeriodo(p.inicio, p.fim);

  const paciente = process.env.PACIENTE_NOME || '';
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="pressao-${periodo || 'relatorio'}.pdf"`);
  doc.pipe(res);

  // Cabeçalho
  doc.fontSize(18).font('Helvetica-Bold').text('Relatório de Pressão Arterial', { align: 'center' });
  if (paciente) doc.fontSize(13).font('Helvetica').text(paciente, { align: 'center' });
  doc.fontSize(11).font('Helvetica').text(`Período: ${p.label}`, { align: 'center' });
  doc.moveDown();

  // Resumo
  doc.fontSize(12).font('Helvetica-Bold').text('Resumo');
  doc.font('Helvetica').fontSize(11);
  doc.text(`Total de medições: ${r.total_medicoes}`);
  if (r.total_medicoes > 0) {
    doc.text(`Média sistólica: ${r.media_sistolica} mmHg`);
    doc.text(`Média diastólica: ${r.media_diastolica} mmHg`);
    if (r.media_bpm) doc.text(`Média BPM: ${r.media_bpm}`);
  }
  doc.moveDown();

  // Tabela
  doc.fontSize(12).font('Helvetica-Bold').text('Medições');
  doc.moveDown(0.5);

  const colX = [50, 155, 220, 285, 335, 400];
  const headers = ['Data/Hora', 'Sistólica', 'Diastólica', 'BPM', 'Origem', 'Observação'];

  doc.fontSize(9).font('Helvetica-Bold');
  headers.forEach((h, i) => doc.text(h, colX[i], doc.y, { width: colX[i + 1] ? colX[i + 1] - colX[i] - 5 : 145, lineBreak: false }));
  doc.moveDown(0.8);

  doc.font('Helvetica').fontSize(9);
  medicoes.forEach(m => {
    if (doc.y > 720) { doc.addPage(); }
    const y = doc.y;
    const cols = [
      m.medido_em ? m.medido_em.replace('T', ' ') : '',
      `${m.sistolica}`,
      `${m.diastolica}`,
      m.bpm ? `${m.bpm}` : '-',
      m.origem,
      m.observacao || '',
    ];
    cols.forEach((c, i) => doc.text(c, colX[i], y, { width: colX[i + 1] ? colX[i + 1] - colX[i] - 5 : 145, lineBreak: false }));
    doc.moveDown(0.8);
  });

  if (medicoes.length === 0) {
    doc.text('Nenhuma medição no período selecionado.');
  }

  doc.end();
});

// DELETE /api/medicoes/:id
router.delete('/medicoes/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ erro: 'ID inválido' });
  const ok = excluir(id);
  if (!ok) return res.status(404).json({ erro: 'Medição não encontrada' });
  res.json({ ok: true });
});

module.exports = router;
