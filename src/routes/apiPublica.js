const express = require('express');
const PDFDocument = require('pdfkit');
const { listarPorPeriodo, resumoPorPeriodo } = require('../db/medicoes');
const { classificar } = require('../lib/classificacao');
const { resolverPeriodo } = require('../lib/periodo');

const router = express.Router({ mergeParams: true });

function verificarToken(req, res, next) {
  const token = process.env.PUBLIC_TOKEN;
  if (!token || req.params.token !== token) {
    return res.status(404).json({ erro: 'Link inválido ou desabilitado.' });
  }
  next();
}

router.use(verificarToken);

router.get('/medicoes', (req, res) => {
  const { periodo, inicio, fim } = req.query;
  const p = resolverPeriodo(periodo, inicio, fim);
  const medicoes = listarPorPeriodo(p.inicio, p.fim).map(m => ({
    ...m, classificacao: classificar(m.sistolica, m.diastolica),
  }));
  res.json({ periodo: p.periodo || periodo, medicoes });
});

router.get('/resumo', (req, res) => {
  const { periodo, inicio, fim } = req.query;
  const p = resolverPeriodo(periodo, inicio, fim);
  const r = resumoPorPeriodo(p.inicio, p.fim);
  const ultimaMedicao = r.ultima
    ? { ...r.ultima, classificacao: classificar(r.ultima.sistolica, r.ultima.diastolica) }
    : null;
  res.json({
    periodo: p.periodo || periodo,
    media_sistolica: r.media_sistolica,
    media_diastolica: r.media_diastolica,
    media_bpm: r.media_bpm,
    total_medicoes: r.total_medicoes,
    ultima_medicao: ultimaMedicao,
    alerta_crise: ultimaMedicao?.classificacao === 'crise',
  });
});

router.get('/pdf', (req, res) => {
  const { periodo, inicio, fim } = req.query;
  const p = resolverPeriodo(periodo, inicio, fim);
  const medicoes = listarPorPeriodo(p.inicio, p.fim).map(m => ({
    ...m, classificacao: classificar(m.sistolica, m.diastolica),
  }));
  const r = resumoPorPeriodo(p.inicio, p.fim);
  const paciente = process.env.PACIENTE_NOME || 'Paciente';

  // Reutiliza o mesmo layout do PDF privado
  const doc = new PDFDocument({ margin: 0, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="pressao-${periodo || 'relatorio'}.pdf"`);
  doc.pipe(res);

  const W = 595.28, MARGIN = 40, CONTENT_W = W - MARGIN * 2;
  const BLUE = '#1d4ed8', GRAY = '#f5f5f4', BORDER = '#e5e5e5';
  const MUTED = '#6b7280', RED = '#E24B4A', WHITE = '#ffffff';

  function formatDT(iso) {
    if (!iso) return '—';
    const s = iso.replace('T', ' ');
    const d = s.slice(0, 10).split('-');
    return `${d[2]}/${d[1]}/${d[0]}  ${s.slice(11, 16)}`;
  }

  function drawRow(y, cols, widths, opts = {}) {
    const { bold = false, bg, textColor = '#1a1a1a', rowH = 22 } = opts;
    if (bg) doc.rect(MARGIN, y, CONTENT_W, rowH).fill(bg);
    doc.fillColor(BORDER).rect(MARGIN, y + rowH - 0.5, CONTENT_W, 0.5).fill();
    let x = MARGIN;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor(textColor);
    cols.forEach((text, i) => {
      doc.text(String(text ?? '—'), x + 5, y + 6, { width: widths[i] - 10, lineBreak: false, ellipsis: true });
      x += widths[i];
    });
    return y + rowH;
  }

  doc.rect(0, 0, W, 90).fill(BLUE);
  doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(22)
    .text('Relatório de Pressão Arterial', MARGIN, 18, { width: CONTENT_W, align: 'center' });
  doc.font('Helvetica').fontSize(11).fillColor('rgba(255,255,255,0.85)')
    .text(paciente, MARGIN, 46, { width: CONTENT_W, align: 'center' });
  doc.fontSize(10).fillColor('rgba(255,255,255,0.7)')
    .text(`Período: ${p.label}  ·  Gerado em ${new Date().toLocaleDateString('pt-BR')}`, MARGIN, 64, { width: CONTENT_W, align: 'center' });

  let y = 108;
  const cardW = (CONTENT_W - 12) / 4;
  [
    { label: 'Média Sistólica',   value: r.total_medicoes ? `${r.media_sistolica}` : '—', unit: 'mmHg' },
    { label: 'Média Diastólica',  value: r.total_medicoes ? `${r.media_diastolica}` : '—', unit: 'mmHg' },
    { label: 'Média BPM',         value: r.media_bpm ? `${r.media_bpm}` : '—', unit: 'bpm' },
    { label: 'Total de medições', value: `${r.total_medicoes}`, unit: 'registros' },
  ].forEach((card, i) => {
    const cx = MARGIN + i * (cardW + 4);
    doc.roundedRect(cx, y, cardW, 62, 4).fill(GRAY);
    doc.rect(cx, y, 3, 62).fill(BLUE);
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(card.label.toUpperCase(), cx + 10, y + 10, { width: cardW - 14 });
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#1a1a1a').text(card.value, cx + 10, y + 22, { width: cardW - 14, lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(card.unit, cx + 10, y + 47, { width: cardW - 14 });
  });
  y += 78;

  if (r.ultima) {
    const cl = classificar(r.ultima.sistolica, r.ultima.diastolica);
    const isCrise = cl === 'crise';
    const bg2 = isCrise ? '#fef2f2' : '#eff6ff', border2 = isCrise ? RED : BLUE;
    doc.roundedRect(MARGIN, y, CONTENT_W, 38, 4).fill(bg2);
    doc.rect(MARGIN, y, 3, 38).fill(border2);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(border2).text('ÚLTIMA MEDIÇÃO', MARGIN + 10, y + 8);
    const uText = `${formatDT(r.ultima.medido_em)}   ·   ${r.ultima.sistolica}/${r.ultima.diastolica} mmHg${r.ultima.bpm ? `   ·   ${r.ultima.bpm} bpm` : ''}`;
    doc.font('Helvetica').fontSize(10).fillColor('#1a1a1a').text(uText, MARGIN + 10, y + 21);
    if (isCrise) doc.font('Helvetica-Bold').fontSize(9).fillColor(RED).text('CRISE HIPERTENSIVA', MARGIN + CONTENT_W - 130, y + 15);
    y += 52;
  }

  doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a1a1a').text('Medições do período', MARGIN, y);
  y += 18;

  const widths = [118, 68, 72, 52, 205];
  const headers = ['Data / Hora', 'Sistólica', 'Diastólica', 'BPM', 'Observação'];

  doc.rect(MARGIN, y, CONTENT_W, 22).fill(BLUE);
  let hx = MARGIN;
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(WHITE);
  headers.forEach((h, i) => { doc.text(h, hx + 5, y + 7, { width: widths[i] - 10, lineBreak: false }); hx += widths[i]; });
  y += 22;

  if (medicoes.length === 0) {
    doc.rect(MARGIN, y, CONTENT_W, 30).fill(GRAY);
    doc.font('Helvetica').fontSize(10).fillColor(MUTED).text('Nenhuma medição no período.', MARGIN, y + 10, { width: CONTENT_W, align: 'center' });
    y += 30;
  } else {
    medicoes.slice().reverse().forEach((m, idx) => {
      if (y > 770) {
        doc.addPage({ margin: 0 });
        doc.rect(0, 0, W, 90).fill(BLUE);
        doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(16).text('Relatório de Pressão Arterial', MARGIN, 32, { width: CONTENT_W, align: 'center' });
        doc.font('Helvetica').fontSize(10).fillColor('rgba(255,255,255,0.7)').text(`${paciente}  ·  ${p.label}`, MARGIN, 56, { width: CONTENT_W, align: 'center' });
        y = 108;
        doc.rect(MARGIN, y, CONTENT_W, 22).fill(BLUE);
        let hx2 = MARGIN;
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(WHITE);
        headers.forEach((h, i) => { doc.text(h, hx2 + 5, y + 7, { width: widths[i] - 10, lineBreak: false }); hx2 += widths[i]; });
        y += 22;
      }
      const isCrise = m.classificacao === 'crise';
      y = drawRow(y, [
        formatDT(m.medido_em), `${m.sistolica} mmHg`, `${m.diastolica} mmHg`,
        m.bpm ? `${m.bpm}` : '—', m.observacao || '',
      ], widths, { bg: isCrise ? '#fef2f2' : (idx % 2 === 0 ? WHITE : GRAY), textColor: isCrise ? RED : '#1a1a1a' });
    });
  }

  y += 20;
  doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W, y).strokeColor(BORDER).lineWidth(0.5).stroke();
  doc.font('Helvetica').fontSize(8).fillColor(MUTED)
    .text(`Pulso — Sistema de Monitoramento de Pressão Arterial  ·  ${new Date().toLocaleString('pt-BR')}`, MARGIN, y + 8, { width: CONTENT_W, align: 'center' });

  doc.end();
});

module.exports = router;
