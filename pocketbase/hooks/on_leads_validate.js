// F1-T04 — SPEC 1.2 RN-1.4: lead sem nome/empresa/contato não é confirmado.
// Rascunho (incompleto = true) é permitido: os campos obrigatórios do schema são relaxados aqui
// porque o hook decide o que é "confirmado" — schema required + hook não podem contradizer.
// Se o lead não é rascunho e falta campo obrigatório, o hook bloqueia com mensagem clara.
onRecordCreate((e) => {
  const r = e.record
  const incompleto = r.get('incompleto') === true
  const faltando = []
  if (!r.get('nome')) faltando.push('nome')
  if (!r.get('empresa')) faltando.push('empresa')
  if (!r.get('contato')) faltando.push('contato')
  if (faltando.length > 0 && !incompleto) {
    throw new BadRequestError(
      'Lead incompleto não pode ser confirmado sem nome, empresa e contato. Preencha os campos obrigatórios ou marque como rascunho (incompleto).',
    )
  }
  if (incompleto) {
    // rascunho: status não pode ser 'novo' (não entra na fila de qualificação)
    if (r.get('status') === 'novo') r.set('status', 'pendente')
  }
  e.next()
}, 'leads')

onRecordUpdate((e) => {
  const r = e.record
  const incompleto = r.get('incompleto') === true
  const faltando = []
  if (!r.get('nome')) faltando.push('nome')
  if (!r.get('empresa')) faltando.push('empresa')
  if (!r.get('contato')) faltando.push('contato')
  if (faltando.length > 0 && !incompleto) {
    throw new BadRequestError(
      'Lead incompleto não pode ser confirmado sem nome, empresa e contato. Preencha os campos obrigatórios ou marque como rascunho (incompleto).',
    )
  }
  e.next()
}, 'leads')
