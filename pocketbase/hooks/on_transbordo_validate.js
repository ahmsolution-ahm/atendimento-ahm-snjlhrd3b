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
      'O transbordo exige um motivo: registre o que precisa ser avaliado pelo especialista.',
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
      'Não é possível fechar o transbordo sem a resolução: registre a resposta do especialista antes de concluir.',
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

// F1-T12 — SPEC 1.4 RN-1.12: a resolução DEVOLVE o lead a um status válido.
// Ao resolver (transição para Resolvido), o lead vinculado volta para "pendente"
// com justificativa auditável em qualificacao_resultado — nunca é apagado.
// Devolução direta a "oportunidade" fica para a F1-T13 (coleção ainda não existe).
// Reabertura (Resolvido → Aberto) NÃO altera o lead: ele permanece pendente até
// ser requalificado manualmente (evita loop automático transbordo↔qualificação).
onRecordAfterUpdateSuccess((e) => {
  const r = e.record
  const virouResolvido =
    r.getString('status') === 'Resolvido' && r.original().getString('status') !== 'Resolvido'
  if (!virouResolvido) return
  const leadId = r.getString('lead')
  if (leadId === '') return
  try {
    const lead = $app.findRecordById('leads', leadId)
    const resolucao = r.getString('resolucao')
    const resumo = resolucao.length > 120 ? resolucao.slice(0, 117) + '...' : resolucao
    if (lead.getString('status') === 'transbordo') {
      lead.set('status', 'pendente')
      lead.set(
        'qualificacao_resultado',
        `Resolução do especialista: ${resumo} — Lead devolvido para nova qualificação.`,
      )
      lead.set('qualificacao_pendencias', ['Requalificar após a resolução do transbordo'])
      $app.save(lead)
    }
  } catch (err) {
    // lead removido ou indisponível: a resolução do item permanece válida
    $app.logger().warn('F1-T12: lead não devolvido na resolução', { leadId, err: String(err) })
  }
}, 'transbordos')
