// F1-T04 — SPEC 1.2 RN-1.4: lead sem nome/empresa/contato não é confirmado.
// Rascunho só é permitido com incompleto = true (padrão dos hooks de produto, AP-2026-09-25-1420).
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
