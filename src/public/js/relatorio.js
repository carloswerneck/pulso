let periodoAtivo = '30d';

function formatarDataHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso.replace(' ', 'T'));
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function carregar(periodo) {
  const [resumoRes, medicoesRes] = await Promise.all([
    fetch(`/api/medicoes/resumo?periodo=${periodo}`),
    fetch(`/api/medicoes?periodo=${periodo}`),
  ]);

  if (!resumoRes.ok || !medicoesRes.ok) return;

  const resumo = await resumoRes.json();
  const { medicoes } = await medicoesRes.json();

  // Resumo topo
  document.getElementById('mediaSis').textContent = resumo.media_sistolica ?? '—';
  document.getElementById('mediaDia').textContent = resumo.media_diastolica ?? '—';
  document.getElementById('mediaBpm').textContent = resumo.media_bpm ?? '—';
  document.getElementById('total').textContent = resumo.total_medicoes ?? '0';

  // Tabela completa, ordem decrescente
  const tbody = document.getElementById('tabelaCorpo');
  const lista = [...medicoes].reverse();
  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="sem-dados">Nenhuma medição no período.</td></tr>';
    return;
  }
  tbody.innerHTML = lista.map(m => `
    <tr class="${m.classificacao === 'crise' ? 'crise' : ''}">
      <td>${formatarDataHora(m.medido_em)}</td>
      <td>${m.sistolica}</td>
      <td>${m.diastolica}</td>
      <td>${m.bpm ?? '—'}</td>
      <td>${m.origem}</td>
      <td>${m.observacao ?? ''}</td>
    </tr>
  `).join('');
}

document.querySelectorAll('.btn-filtro').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn-filtro').forEach(b => b.classList.remove('ativo'));
    btn.classList.add('ativo');
    periodoAtivo = btn.dataset.periodo;
    carregar(periodoAtivo);
  });
});

document.getElementById('btnPdf').addEventListener('click', () => {
  window.open(`/api/medicoes/pdf?periodo=${periodoAtivo}`, '_blank');
});

// Botão compartilhar
fetch('/api/link-publico').then(r => r.json()).then(data => {
  const btn = document.getElementById('btnCompartilhar');
  if (!data.ativo) {
    btn.title = 'Configure PUBLIC_TOKEN no servidor para habilitar';
    btn.style.opacity = '0.4';
    btn.style.cursor = 'not-allowed';
    return;
  }
  btn.addEventListener('click', () => {
    const url = data.url;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        const orig = btn.textContent;
        btn.textContent = 'Link copiado!';
        setTimeout(() => { btn.textContent = orig; }, 2000);
      });
    } else {
      prompt('Copie o link público:', url);
    }
  });
});

carregar(periodoAtivo);
