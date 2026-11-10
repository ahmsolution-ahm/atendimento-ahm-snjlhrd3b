// F1-T04 — SPEC 1.2 RN-1.6: lead sem produto de interesse fica com status pendente.
// Aplicado na criação e na atualização (se o produto for removido depois, volta a pendente).
onRecordCreate((e) => {
  const r = e.record
  if (!r.get('produto_interesse')) {
    r.set('status', 'pendente')
  }
  e.next()
}, 'leads')

onRecordUpdate((e) => {
  const r = e.record
  if (!r.get('produto_interesse') && r.get('status') !== 'pendente') {
    r.set('status', 'pendente')
  }
  e.next()
}, 'leads')
