// F1-T10 — SPEC 1.4: validações da fila de transbordo.
// RN-1.11: transbordo criado exige motivo legível (a IA não responde sem base — o
// motivo é o que o especialista vai ler).
// RN-1.12: resolução — fechar um transbordo exige resolução preenchida (resolução
// vazia não fecha); ao resolver, registra resolvido_em/resolvido_por automaticamente.
// Cenário limite: sem especialista, o item entra como "Pendente atribuição".
onRecordCreate((e) => {
  const r = e.record
  if (r.getString('motivo').trim() === '') {
    throw new BadRequestError(
      'Transbordo sem motivo não é permitido (RN-1.11): registre o que exige o especialista.',
    )
  }
  if (r.getString('status') === '') {
    // cenário limite (SPEC 1.4): sem especialista → pendente de atribuição
    r.set('status', r.getString('especialista') === '' ? 'Pendente atribuição' : 'Aberto')
  }
  return e.next()
}, 'transbordos')

onRecordUpdate((e) => {
  const r = e.record
  // RN-1.12: resolução vazia não fecha o transbordo (validação de dados, vale para qualquer origem)
  if (r.getString('status') === 'Resolvido' && r.getString('resolucao').trim() === '') {
    throw new BadRequestError(
      'Resolução vazia não fecha o transbordo (RN-1.12): registre a resposta do especialista antes de resolver.',
    )
  }
  // reabrir (rollback): volta para Aberto — permitido, histórico preservado nos campos
  return e.next()
}, 'transbordos')

// auditoria de quem resolveu — hook de REQUISIÇÃO (model hook não tem e.auth)
onRecordUpdateRequest((e) => {
  const r = e.record
  if (
    r.getString('status') === 'Resolvido' &&
    r.original().getString('status') !== 'Resolvido' &&
    r.getString('resolvido_por') === ''
  ) {
    r.set('resolvido_em', new Date().toISOString())
    r.set('resolvido_por', e.auth?.id || '')
  }
  return e.next()
}, 'transbordos')
