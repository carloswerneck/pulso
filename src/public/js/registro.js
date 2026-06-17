const idEdicao = new URLSearchParams(location.search).get('id');
const modoEdicao = !!idEdicao;

// Preencher data/hora com momento atual (padrão para novo registro)
function preencherAgora() {
  const n = new Date();
  document.getElementById('data').value = n.toISOString().slice(0, 10);
  document.getElementById('hora').value = n.toTimeString().slice(0, 5);
}

preencherAgora();

// Se modo edição, carregar dados existentes
if (modoEdicao) {
  document.querySelector('h1').textContent = 'Editar medição';
  document.querySelector('[type=submit]').textContent = 'Salvar alterações';

  fetch(`/api/medicoes/${idEdicao}`).then(r => r.json()).then(m => {
    if (m.erro) { alert('Medição não encontrada.'); return; }
    document.getElementById('sistolica').value  = m.sistolica;
    document.getElementById('diastolica').value = m.diastolica;
    document.getElementById('bpm').value        = m.bpm ?? '';
    document.getElementById('observacao').value = m.observacao ?? '';
    if (m.medido_em) {
      const dt = m.medido_em.replace(' ', 'T');
      document.getElementById('data').value = dt.slice(0, 10);
      document.getElementById('hora').value = dt.slice(11, 16);
    }
  });
}

// Copiar sugestão para textarea
document.getElementById('observacaoSel').addEventListener('change', (e) => {
  if (e.target.value) {
    document.getElementById('observacao').value = e.target.value;
    e.target.value = '';
  }
});

document.getElementById('formRegistro').addEventListener('submit', async (e) => {
  e.preventDefault();

  const erroEl    = document.getElementById('erroMsg');
  const alertaEl  = document.getElementById('alertaCrise');
  const sucessoEl = document.getElementById('msgSucesso');
  erroEl.style.display = 'none';
  alertaEl.classList.remove('visivel');
  sucessoEl.classList.remove('visivel');

  const data = document.getElementById('data').value;
  const hora = document.getElementById('hora').value;
  const bpmVal = document.getElementById('bpm').value;

  const body = {
    sistolica:  Number(document.getElementById('sistolica').value),
    diastolica: Number(document.getElementById('diastolica').value),
    medido_em:  `${data}T${hora}:00`,
    observacao: document.getElementById('observacao').value || null,
    origem:     'manual',
  };
  if (bpmVal) body.bpm = Number(bpmVal);

  const url    = modoEdicao ? `/api/medicoes/${idEdicao}` : '/api/medicoes';
  const method = modoEdicao ? 'PUT' : 'POST';

  const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json();

  if (!res.ok) {
    erroEl.textContent = json.erro || 'Erro ao salvar.';
    erroEl.style.display = 'block';
    return;
  }

  if (json.alerta_crise) alertaEl.classList.add('visivel');

  if (modoEdicao) {
    sucessoEl.textContent = `Medição atualizada: ${json.sistolica}/${json.diastolica} mmHg${json.bpm ? `, ${json.bpm} bpm` : ''}.`;
    sucessoEl.classList.add('visivel');
  } else {
    sucessoEl.textContent = `Medição registrada: ${json.sistolica}/${json.diastolica} mmHg${json.bpm ? `, ${json.bpm} bpm` : ''}.`;
    sucessoEl.classList.add('visivel');
    e.target.reset();
    preencherAgora();
  }

  window.scrollTo(0, 0);
});
