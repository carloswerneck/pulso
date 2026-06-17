// Preencher data/hora com momento atual
const agora = new Date();
document.getElementById('data').value = agora.toISOString().slice(0, 10);
document.getElementById('hora').value = agora.toTimeString().slice(0, 5);

// Copiar sugestão para textarea
document.getElementById('observacaoSel').addEventListener('change', (e) => {
  if (e.target.value) {
    document.getElementById('observacao').value = e.target.value;
    e.target.value = '';
  }
});

document.getElementById('formRegistro').addEventListener('submit', async (e) => {
  e.preventDefault();

  const erroEl = document.getElementById('erroMsg');
  const alertaEl = document.getElementById('alertaCrise');
  const sucessoEl = document.getElementById('msgSucesso');
  erroEl.style.display = 'none';
  alertaEl.classList.remove('visivel');
  sucessoEl.classList.remove('visivel');

  const data = document.getElementById('data').value;
  const hora = document.getElementById('hora').value;
  const bpmVal = document.getElementById('bpm').value;

  const body = {
    sistolica: Number(document.getElementById('sistolica').value),
    diastolica: Number(document.getElementById('diastolica').value),
    medido_em: `${data}T${hora}:00`,
    observacao: document.getElementById('observacao').value || null,
    origem: 'manual',
  };
  if (bpmVal) body.bpm = Number(bpmVal);

  const res = await fetch('/api/medicoes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = await res.json();

  if (!res.ok) {
    erroEl.textContent = json.erro || 'Erro ao salvar.';
    erroEl.style.display = 'block';
    return;
  }

  if (json.alerta_crise) {
    alertaEl.classList.add('visivel');
  }

  sucessoEl.textContent = `Medição registrada: ${json.sistolica}/${json.diastolica} mmHg${json.bpm ? `, ${json.bpm} bpm` : ''}.`;
  sucessoEl.classList.add('visivel');
  e.target.reset();

  // Restaurar data/hora atual após reset
  const n = new Date();
  document.getElementById('data').value = n.toISOString().slice(0, 10);
  document.getElementById('hora').value = n.toTimeString().slice(0, 5);

  window.scrollTo(0, 0);
});
