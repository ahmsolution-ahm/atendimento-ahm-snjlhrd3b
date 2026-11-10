// F1-T08 — SPEC 1.3: reprocessamento auditável — o resultado ANTERIOR vai para o histórico.
// Regras: (1) se o lead já tinha qualificacao_resultado e este será substituído, anexa ao histórico
// {em: qualificado_em || updated, por: qualificado_por, status: status anterior, resultado: resultado anterior};
// (2) cap de 20 entradas (mais recentes); (3) rollback para pendente também registra no histórico.
onRecordUpdate((e) => {
  const r = e.record
  const novoResultado = r.getString('qualificacao_resultado')
  const resultadoAnterior = r.original().getString('qualificacao_resultado')
  const statusAnterior = r.original().getString('status')

  // só registra quando o resultado muda de fato (idempotência: reprocessar igual não duplica)
  if (resultadoAnterior !== '' && novoResultado !== resultadoAnterior) {
    let historico = []
    try {
      // campo json do PocketBase: pode chegar como array/objeto (via API) ou string (via set)
      const raw = r.get('qualificacao_historico')
      if (Array.isArray(raw)) historico = raw
      else if (typeof raw === 'string' && raw) historico = JSON.parse(raw)
    } catch (_) {
      historico = []
    }
    const entrada = {
      em: r.original().getString('qualificado_em') || r.original().getString('updated'),
      por: r.original().getString('qualificado_por') || '',
      status: statusAnterior,
      resultado: resultadoAnterior,
    }
    historico.unshift(entrada)
    if (historico.length > 20) historico = historico.slice(0, 20)
    // r.set em campo json exige STRING JSON (a API serializa arrays, o hook não — lição F1-T08)
    r.set('qualificacao_historico', JSON.stringify(historico))
  }
  e.next()
}, 'leads')
