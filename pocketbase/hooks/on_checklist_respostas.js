// Fase 2 · Bloco 2 · Item 2 (F2-T05, RN-2.4) — respostas do checklist de etapa.
// - O item precisa pertencer à etapa do registro de histórico respondido.
// - Só se responde a etapa em andamento (registro de histórico sem saiu_em): depois que a
//   etapa foi encerrada, o checklist vira registro histórico e não muda mais.
// - Respostas são imutáveis (sem edição); quem respondeu e quando é gravado pelo servidor.
onRecordCreate((e) => {
  const r = e.record
  let hist = null
  let item = null
  try {
    hist = $app.findRecordById('oportunidade_etapas', r.getString('historico'))
    item = $app.findRecordById('etapa_checklist_itens', r.getString('item'))
  } catch (_) {
    throw new BadRequestError('Etapa ou item de checklist não encontrado.')
  }
  if (item.getString('etapa') !== hist.getString('etapa')) {
    throw new BadRequestError('Este item de checklist não pertence à etapa informada.')
  }
  if (hist.getString('saiu_em') !== '') {
    throw new BadRequestError(
      'Esta etapa já foi encerrada: o checklist não pode mais ser alterado.',
    )
  }
  return e.next()
}, 'etapa_checklist_respostas')

onRecordCreateRequest((e) => {
  e.record.set('respondido_por', e.auth ? e.auth.id : '')
  e.record.set('respondido_em', new Date().toISOString())
  return e.next()
}, 'etapa_checklist_respostas')

onRecordUpdateRequest((e) => {
  throw new BadRequestError('Respostas de checklist não podem ser alteradas depois de registradas.')
}, 'etapa_checklist_respostas')
