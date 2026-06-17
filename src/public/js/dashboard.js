let periodoAtivo = '30d';
let grafico = null;

function formatarDataHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso.replace(' ', 'T'));
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatarData(iso) {
  if (!iso) return '—';
  const d = new Date(iso.replace(' ', 'T'));
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

async function carregar(periodo) {
  const [resumoRes, medicoesRes] = await Promise.all([
    fetch(`/api/medicoes/resumo?periodo=${periodo}`),
    fetch(`/api/medicoes?periodo=${periodo}`),
  ]);

  if (!resumoRes.ok || !medicoesRes.ok) return;

  const resumo = await resumoRes.json();
  const { medicoes } = await medicoesRes.json();

  // Alerta crise
  document.getElementById('alertaCrise').classList.toggle('visivel', !!resumo.alerta_crise);

  // Cards
  document.getElementById('mediaSis').textContent = resumo.media_sistolica ?? '—';
  document.getElementById('mediaDia').textContent = resumo.media_diastolica ?? '—';
  document.getElementById('mediaBpm').textContent = resumo.media_bpm ?? '—';

  const u = resumo.ultima_medicao;
  document.getElementById('ultimaVal').textContent = u ? `${u.sistolica}/${u.diastolica}` : '—';
  document.getElementById('ultimaData').textContent = u ? formatarDataHora(u.medido_em) : '';

  // Gráfico
  const labels = medicoes.map(m => formatarData(m.medido_em));
  const dataSis = medicoes.map(m => m.sistolica);
  const dataDia = medicoes.map(m => m.diastolica);

  if (grafico) grafico.destroy();

  const ctx = document.getElementById('grafico').getContext('2d');
  grafico = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Sistólica',
          data: dataSis,
          borderColor: '#f97316',
          backgroundColor: 'rgba(249,115,22,0.08)',
          tension: 0.3,
          pointRadius: medicoes.length > 60 ? 0 : 3,
          fill: false,
        },
        {
          label: 'Diastólica',
          data: dataDia,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.08)',
          tension: 0.3,
          borderDash: [5, 3],
          pointRadius: medicoes.length > 60 ? 0 : 3,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, font: { size: 12 } } },
        tooltip: { mode: 'index', intersect: false },
      },
      scales: {
        x: { ticks: { maxTicksLimit: 10, font: { size: 11 } }, grid: { display: false } },
        y: { min: 50, ticks: { font: { size: 11 } } },
      },
    },
  });

  // Tabela (mostrar as últimas 20, ordem decrescente)
  const tbody = document.getElementById('tabelaCorpo');
  const recentes = [...medicoes].reverse().slice(0, 20);
  if (recentes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="sem-dados">Nenhuma medição no período.</td></tr>';
    return;
  }
  tbody.innerHTML = recentes.map(m => `
    <tr class="${m.classificacao === 'crise' ? 'crise' : ''}">
      <td>${formatarDataHora(m.medido_em)}</td>
      <td>${m.sistolica}</td>
      <td>${m.diastolica}</td>
      <td>${m.bpm ?? '—'}</td>
      <td>${m.observacao ?? ''}</td>
      <td style="white-space:nowrap">
        <a href="/registro?id=${m.id}" class="btn btn-secondary" style="padding:3px 10px;font-size:12px">Editar</a>
        <button class="btn btn-secondary" style="padding:3px 10px;font-size:12px;margin-left:4px"
          onclick="excluir(${m.id})">Excluir</button>
      </td>
    </tr>
  `).join('');
}

async function excluir(id) {
  if (!confirm('Excluir esta medição?')) return;
  const res = await fetch(`/api/medicoes/${id}`, { method: 'DELETE' });
  if (res.ok) carregar(periodoAtivo);
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

carregar(periodoAtivo);
