const express = require('express');
const PDFDocument = require('pdfkit');
const { requireApiAuth } = require('../middleware/apiAuth');
const { inserir, buscarPorId, atualizar, listarPorPeriodo, resumoPorPeriodo, excluir } = require('../db/medicoes');
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

// GET /api/link-publico
router.get('/link-publico', (req, res) => {
  const token = process.env.PUBLIC_TOKEN;
  if (!token) return res.json({ ativo: false });
  const base = `${req.protocol}://${req.get('host')}`;
  res.json({ ativo: true, url: `${base}/p/${token}` });
});

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
  const medicoes = listarPorPeriodo(p.inicio, p.fim).map(m => ({
    ...m, classificacao: classificar(m.sistolica, m.diastolica),
  }));
  const r = resumoPorPeriodo(p.inicio, p.fim);

  const paciente = process.env.PACIENTE_NOME || 'Paciente';
  const doc = new PDFDocument({ margin: 0, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="pressao-${periodo || 'relatorio'}.pdf"`);
  doc.pipe(res);

  const W = 595.28;
  const MARGIN = 40;
  const CONTENT_W = W - MARGIN * 2;
  const BLUE = '#1d4ed8';
  const GRAY = '#f5f5f4';
  const BORDER = '#e5e5e5';
  const MUTED = '#6b7280';
  const RED = '#E24B4A';
  const WHITE = '#ffffff';

  function formatDT(iso) {
    if (!iso) return '—';
    const s = iso.replace('T', ' ');
    const d = s.slice(0, 10).split('-');
    const t = s.slice(11, 16);
    return `${d[2]}/${d[1]}/${d[0]}  ${t}`;
  }

  function drawTableRow(y, cols, widths, opts = {}) {
    const { bold = false, bg, textColor = '#1a1a1a', rowH = 22 } = opts;
    if (bg) {
      doc.rect(MARGIN, y, CONTENT_W, rowH).fill(bg);
    }
    doc.fillColor(BORDER).rect(MARGIN, y + rowH - 0.5, CONTENT_W, 0.5).fill();

    let x = MARGIN;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor(textColor);
    cols.forEach((text, i) => {
      doc.text(String(text ?? '—'), x + 5, y + 6, { width: widths[i] - 10, lineBreak: false, ellipsis: true });
      x += widths[i];
    });
    return y + rowH;
  }

  // ── HEADER BAR ──────────────────────────────────────────────
  doc.rect(0, 0, W, 90).fill(BLUE);
  doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(22)
    .text('Relatório de Pressão Arterial', MARGIN, 18, { width: CONTENT_W, align: 'center' });
  doc.font('Helvetica').fontSize(11).fillColor('rgba(255,255,255,0.85)')
    .text(paciente, MARGIN, 46, { width: CONTENT_W, align: 'center' });
  doc.fontSize(10).fillColor('rgba(255,255,255,0.7)')
    .text(`Período: ${p.label}  ·  Gerado em ${new Date().toLocaleDateString('pt-BR')}`, MARGIN, 64, { width: CONTENT_W, align: 'center' });

  let y = 108;

  // ── CARDS DE RESUMO ──────────────────────────────────────────
  const cardW = (CONTENT_W - 12) / 4;
  const cards = [
    { label: 'Média Sistólica',  value: r.total_medicoes ? `${r.media_sistolica}` : '—', unit: 'mmHg' },
    { label: 'Média Diastólica', value: r.total_medicoes ? `${r.media_diastolica}` : '—', unit: 'mmHg' },
    { label: 'Média BPM',        value: r.media_bpm ? `${r.media_bpm}` : '—', unit: 'bpm' },
    { label: 'Total de medições', value: `${r.total_medicoes}`, unit: 'registros' },
  ];

  cards.forEach((card, i) => {
    const cx = MARGIN + i * (cardW + 4);
    doc.roundedRect(cx, y, cardW, 62, 4).fill(GRAY);
    doc.rect(cx, y, 3, 62).fill(BLUE);
    doc.font('Helvetica').fontSize(8).fillColor(MUTED)
      .text(card.label.toUpperCase(), cx + 10, y + 10, { width: cardW - 14 });
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#1a1a1a')
      .text(card.value, cx + 10, y + 22, { width: cardW - 14, lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor(MUTED)
      .text(card.unit, cx + 10, y + 47, { width: cardW - 14 });
  });

  y += 78;

  // ── ÚLTIMA MEDIÇÃO ───────────────────────────────────────────
  if (r.ultima) {
    const u = r.ultima;
    const cl = classificar(u.sistolica, u.diastolica);
    const isCrise = cl === 'crise';
    const bgUltima = isCrise ? '#fef2f2' : '#eff6ff';
    const borderUltima = isCrise ? RED : BLUE;

    doc.roundedRect(MARGIN, y, CONTENT_W, 38, 4).fill(bgUltima);
    doc.rect(MARGIN, y, 3, 38).fill(borderUltima);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(borderUltima)
      .text('ÚLTIMA MEDIÇÃO', MARGIN + 10, y + 8);
    const uText = `${formatDT(u.medido_em)}   ·   ${u.sistolica}/${u.diastolica} mmHg${u.bpm ? `   ·   ${u.bpm} bpm` : ''}`;
    doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a')
      .text(uText, MARGIN + 10, y + 21);
    if (isCrise) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(RED)
        .text('CRISE HIPERTENSIVA', MARGIN + CONTENT_W - 130, y + 15);
    }
    y += 52;
  }

  // ── TÍTULO DA TABELA ─────────────────────────────────────────
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a1a1a')
    .text('Medições do período', MARGIN, y);
  y += 18;

  // ── TABELA ───────────────────────────────────────────────────
  const widths = [118, 68, 72, 52, 52, 153];
  const headers = ['Data / Hora', 'Sistólica', 'Diastólica', 'BPM', 'Origem', 'Observação'];

  // cabeçalho
  doc.rect(MARGIN, y, CONTENT_W, 22).fill(BLUE);
  let hx = MARGIN;
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(WHITE);
  headers.forEach((h, i) => {
    doc.text(h, hx + 5, y + 7, { width: widths[i] - 10, lineBreak: false });
    hx += widths[i];
  });
  y += 22;

  if (medicoes.length === 0) {
    doc.rect(MARGIN, y, CONTENT_W, 30).fill(GRAY);
    doc.font('Helvetica').fontSize(10).fillColor(MUTED)
      .text('Nenhuma medição no período selecionado.', MARGIN, y + 10, { width: CONTENT_W, align: 'center' });
    y += 30;
  } else {
    medicoes.slice().reverse().forEach((m, idx) => {
      if (y > 770) {
        doc.addPage({ margin: 0 });
        doc.rect(0, 0, W, 90).fill(BLUE);
        doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(16)
          .text('Relatório de Pressão Arterial', MARGIN, 32, { width: CONTENT_W, align: 'center' });
        doc.font('Helvetica').fontSize(10).fillColor('rgba(255,255,255,0.7)')
          .text(`${paciente}  ·  ${p.label}`, MARGIN, 56, { width: CONTENT_W, align: 'center' });
        y = 108;

        doc.rect(MARGIN, y, CONTENT_W, 22).fill(BLUE);
        let hx2 = MARGIN;
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(WHITE);
        headers.forEach((h, i) => {
          doc.text(h, hx2 + 5, y + 7, { width: widths[i] - 10, lineBreak: false });
          hx2 += widths[i];
        });
        y += 22;
      }

      const isCrise = m.classificacao === 'crise';
      const rowBg = isCrise ? '#fef2f2' : (idx % 2 === 0 ? WHITE : GRAY);
      const textColor = isCrise ? RED : '#1a1a1a';

      const cols = [
        formatDT(m.medido_em),
        `${m.sistolica} mmHg`,
        `${m.diastolica} mmHg`,
        m.bpm ? `${m.bpm}` : '—',
        m.origem,
        m.observacao || '',
      ];
      y = drawTableRow(y, cols, widths, { bg: rowBg, textColor });
    });
  }

  // ── RODAPÉ ───────────────────────────────────────────────────
  y += 20;
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W, y).strokeColor(BORDER).lineWidth(0.5).stroke();
  doc.font('Helvetica').fontSize(8).fillColor(MUTED)
    .text(`Pulso — Sistema de Monitoramento de Pressão Arterial  ·  ${new Date().toLocaleString('pt-BR')}`,
      MARGIN, y + 8, { width: CONTENT_W, align: 'center' });

  doc.end();
});

// GET /api/medicoes/:id
router.get('/medicoes/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ erro: 'ID inválido' });
  const m = buscarPorId(id);
  if (!m) return res.status(404).json({ erro: 'Medição não encontrada' });
  const classificacao = classificar(m.sistolica, m.diastolica);
  res.json({ ...m, classificacao, alerta_crise: classificacao === 'crise' });
});

// PUT /api/medicoes/:id
router.put('/medicoes/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ erro: 'ID inválido' });

  const exists = buscarPorId(id);
  if (!exists) return res.status(404).json({ erro: 'Medição não encontrada' });

  const { sistolica, diastolica, bpm, medido_em, observacao, origem } = req.body;
  const erro = validar({ sistolica, diastolica, bpm });
  if (erro) return res.status(400).json({ erro });

  const medidoEm = medido_em || exists.medido_em;
  const medicao = atualizar(id, {
    sistolica: Number(sistolica),
    diastolica: Number(diastolica),
    bpm: bpm != null ? Number(bpm) : null,
    medido_em: medidoEm,
    observacao: observacao || null,
    origem: origem || exists.origem,
  });

  const classificacao = classificar(medicao.sistolica, medicao.diastolica);
  res.json({ ...medicao, classificacao, alerta_crise: classificacao === 'crise' });
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
