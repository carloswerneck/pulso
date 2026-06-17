function resolverPeriodo(periodo, inicio, fim) {
  if (inicio && fim) {
    return { inicio, fim, label: `${inicio} até ${fim}` };
  }

  const agora = new Date();
  const fimISO = agora.toISOString().slice(0, 19);

  let dias;
  let label;
  if (periodo === '7d' || !periodo) {
    dias = 7;
    label = 'Últimos 7 dias';
  } else if (periodo === '30d') {
    dias = 30;
    label = 'Último mês';
  } else if (periodo === '1a') {
    dias = 365;
    label = 'Último ano';
  } else {
    dias = 30;
    label = 'Último mês';
  }

  const inicioDate = new Date(agora);
  inicioDate.setDate(inicioDate.getDate() - dias);
  const inicioISO = inicioDate.toISOString().slice(0, 19);

  return { inicio: inicioISO, fim: fimISO, label, periodo: periodo || '30d' };
}

module.exports = { resolverPeriodo };
