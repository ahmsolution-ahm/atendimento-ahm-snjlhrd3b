// F1-T14 / F1-T15 — SPEC 1.5 (CA-1-014, CA-1-015): decisões humanas na oportunidade.
//
// Validação (model hook — vale para qualquer origem, sem e.auth):
//   RN-1.14: transição para Rejeitada exige motivo — o comentario precisa ter sido
//            preenchido NESTA decisão (diferente do anterior e não vazio). Um comentário
//            antigo (ex.: nota de requalificação) não serve como motivo da rejeição.
//   Rollback: Aprovada → Em revisão exige justificativa da volta (mesma regra).
//
// Auditoria (request hook — tem e.auth): toda transição de status para
// Aprovada / Rejeitada / Em revisão registra decidido_em/decidido_por com quem fez a
// chamada. Cada nova decisão sobrescreve a anterior (registra a ÚLTIMA decisão; o
// histórico textual fica acumulado em comentario).
// Obs.: toda a lógica fica DENTRO dos callbacks (o JSVM não enxerga funções de topo).

onRecordUpdate((e) => {
  const r = e.record
  const status = r.getString('status')
  const statusAnterior = r.original().getString('status')

  if (status !== statusAnterior) {
    const atual = r.getString('comentario').trim()
    const comentarioNovo = atual !== '' && atual !== r.original().getString('comentario').trim()
    // RN-1.14: rejeição sem motivo é bloqueada
    if (status === 'Rejeitada' && !comentarioNovo) {
      throw new BadRequestError(
        'Não é possível rejeitar a oportunidade sem informar o motivo. Registre o motivo da rejeição e tente novamente.',
      )
    }
    // rollback auditável: aprovada só volta para revisão com justificativa
    if (statusAnterior === 'Aprovada' && status === 'Em revisão' && !comentarioNovo) {
      throw new BadRequestError(
        'Para voltar uma oportunidade aprovada para revisão, informe a justificativa da mudança.',
      )
    }
  }
  return e.next()
}, 'oportunidades')

onRecordUpdateRequest((e) => {
  const r = e.record
  const status = r.getString('status')
  const mudouStatus = status !== r.original().getString('status')
  const decisao = status === 'Aprovada' || status === 'Rejeitada' || status === 'Em revisão'

  if (mudouStatus && decisao) {
    r.set('decidido_em', new Date().toISOString())
    r.set('decidido_por', e.auth?.id || '')
  }
  return e.next()
}, 'oportunidades')
