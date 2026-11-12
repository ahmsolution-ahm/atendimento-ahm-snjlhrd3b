// F1-T19/T20/T21 — SPEC 1.7 (CA-1-019..021): validação e auditoria das interações do lead.
//
// Validação (model hooks — valem para qualquer origem):
//   - data obrigatória e não futura (tolerância de 1 dia para fuso horário);
//   - tipo dentro da lista;
//   - proposta = true exige observacao (o que foi proposto) e não pode estar cancelada;
//   - só UMA proposta ativa (não cancelada) por lead;
//   - cancelamento (cancelada false → true) exige cancelada_motivo;
//   - interação cancelada não é reativada (histórico auditável).
// Auditoria (request hooks — têm e.auth): responsavel padrão = quem registrou;
// cancelada_em/cancelada_por gravados no cancelamento.
// Obs.: a lógica fica DENTRO de cada callback (o JSVM não enxerga funções de topo).

onRecordCreate((e) => {
  const r = e.record
  const tipos = ['Ligação', 'Reunião', 'E-mail', 'WhatsApp', 'Visita', 'Outro']

  const dataTxt = r.getString('data')
  if (dataTxt === '') {
    throw new BadRequestError('Informe a data da interação.')
  }
  const data = new Date(dataTxt.replace(' ', 'T'))
  if (isNaN(data.getTime())) {
    throw new BadRequestError('Informe uma data válida para a interação.')
  }
  if (data.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
    throw new BadRequestError('A data da interação não pode ser futura.')
  }
  if (tipos.indexOf(r.getString('tipo')) < 0) {
    throw new BadRequestError('Selecione um tipo de interação válido.')
  }
  if (r.getBool('cancelada') && r.getString('cancelada_motivo').trim() === '') {
    throw new BadRequestError('Para cancelar a interação, informe o motivo.')
  }
  if (r.getBool('proposta')) {
    if (r.getBool('cancelada')) {
      throw new BadRequestError('Não é possível marcar como proposta uma interação cancelada.')
    }
    if (r.getString('observacao').trim() === '') {
      throw new BadRequestError(
        'Para marcar a proposta, descreva na observação o que foi proposto.',
      )
    }
    const outras = $app.findRecordsByFilter(
      'interacoes',
      'lead = {:lead} && proposta = true && cancelada = false',
      '',
      1,
      0,
      { lead: r.getString('lead') },
    )
    if (outras.length > 0) {
      throw new BadRequestError(
        'Este lead já tem uma proposta registrada em outra interação. Cancele aquela interação antes de marcar uma nova proposta.',
      )
    }
  }
  if (r.getString('criado_em') === '') {
    r.set('criado_em', new Date().toISOString())
  }
  return e.next()
}, 'interacoes')

onRecordUpdate((e) => {
  const r = e.record
  const o = r.original()
  const tipos = ['Ligação', 'Reunião', 'E-mail', 'WhatsApp', 'Visita', 'Outro']

  const dataTxt = r.getString('data')
  if (dataTxt === '') {
    throw new BadRequestError('Informe a data da interação.')
  }
  const data = new Date(dataTxt.replace(' ', 'T'))
  if (isNaN(data.getTime())) {
    throw new BadRequestError('Informe uma data válida para a interação.')
  }
  if (dataTxt !== o.getString('data') && data.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
    throw new BadRequestError('A data da interação não pode ser futura.')
  }
  if (tipos.indexOf(r.getString('tipo')) < 0) {
    throw new BadRequestError('Selecione um tipo de interação válido.')
  }

  // cancelamento auditável: exige motivo; uma vez cancelada, não volta
  if (o.getBool('cancelada') && !r.getBool('cancelada')) {
    throw new BadRequestError('Uma interação cancelada não pode ser reativada.')
  }
  if (
    r.getBool('cancelada') &&
    !o.getBool('cancelada') &&
    r.getString('cancelada_motivo').trim() === ''
  ) {
    throw new BadRequestError('Para cancelar a interação, informe o motivo.')
  }

  // proposta: observação obrigatória e única ativa por lead
  if (r.getBool('proposta') && !o.getBool('proposta')) {
    if (r.getBool('cancelada')) {
      throw new BadRequestError('Não é possível marcar como proposta uma interação cancelada.')
    }
    if (r.getString('observacao').trim() === '') {
      throw new BadRequestError(
        'Para marcar a proposta, descreva na observação o que foi proposto.',
      )
    }
    const outras = $app.findRecordsByFilter(
      'interacoes',
      'lead = {:lead} && proposta = true && cancelada = false && id != {:id}',
      '',
      1,
      0,
      { lead: r.getString('lead'), id: r.id },
    )
    if (outras.length > 0) {
      throw new BadRequestError(
        'Este lead já tem uma proposta registrada em outra interação. Cancele aquela interação antes de marcar uma nova proposta.',
      )
    }
  }
  return e.next()
}, 'interacoes')

onRecordCreateRequest((e) => {
  const r = e.record
  if (r.getString('responsavel') === '' && e.auth) {
    r.set('responsavel', e.auth.id)
  }
  if (r.getBool('cancelada')) {
    r.set('cancelada_em', new Date().toISOString())
    r.set('cancelada_por', e.auth?.id || '')
  }
  return e.next()
}, 'interacoes')

onRecordUpdateRequest((e) => {
  const r = e.record
  if (r.getBool('cancelada') && !r.original().getBool('cancelada')) {
    r.set('cancelada_em', new Date().toISOString())
    r.set('cancelada_por', e.auth?.id || '')
  }
  return e.next()
}, 'interacoes')
