// Fase 2 · Bloco 2 · Item 1 — arquivamento de lead (substitui a exclusão de registro real).
// O lead arquivado sai das listas e contadores, mas continua na base (inclusive na
// verificação de duplicados da importação) e pode ser restaurado.
// Validação (model hook): arquivar exige motivo; registra arquivado_em.
// Auditoria (request hook — tem e.auth): arquivado_por = quem arquivou.
onRecordUpdate((e) => {
  const r = e.record
  if (r.getBool('arquivado') && !r.original().getBool('arquivado')) {
    if (r.getString('arquivado_motivo').trim() === '') {
      throw new BadRequestError('Para arquivar o lead, informe o motivo.')
    }
    r.set('arquivado_em', new Date().toISOString())
  }
  return e.next()
}, 'leads')

onRecordUpdateRequest((e) => {
  const r = e.record
  if (r.getBool('arquivado') && !r.original().getBool('arquivado')) {
    r.set('arquivado_por', e.auth ? e.auth.id : '')
  }
  return e.next()
}, 'leads')
