// F1-T01 — RN-1.1/CA-1-002: produto sem campos obrigatórios não fica Ativo (na criação).
// Rascunho só é permitido com incompleto = true.
onRecordCreate((e) => {
  const r = e.record
  const incompleto = r.get('incompleto') === true
  if (r.get('status') === 'Ativo' && incompleto) {
    throw new BadRequestError(
      'Produto incompleto não pode ficar Ativo. Complete os campos obrigatórios ou marque como rascunho (incompleto).',
    )
  }
  e.next()
}, 'produtos')
