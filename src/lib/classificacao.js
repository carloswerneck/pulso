function classificar(sistolica, diastolica) {
  if (sistolica >= 180 || diastolica >= 120) return 'crise';
  if (sistolica >= 140 || diastolica >= 90)  return 'estagio2';
  if (sistolica >= 130 || diastolica >= 80)  return 'estagio1';
  if (sistolica >= 120)                       return 'pre_hipertensao';
  return 'normal';
}

module.exports = { classificar };
