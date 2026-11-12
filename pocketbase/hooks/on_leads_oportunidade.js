// F1-T13 — SPEC 1.5 RN-1.13: lead qualificado cria/atualiza oportunidade sugerida.
// Roda AFTER update success (transação commitada): quando o lead vira "qualificado",
// cria a oportunidade com justificativa legível do motor; se já existe oportunidade
// ABERTA (Sugerida/Em revisão) do mesmo lead+produto, ATUALIZA justificativa/confiança
// em vez de duplicar. Oportunidade Aprovada/Rejeitada não é reaberta automaticamente
// (decisão humana é da F1-T14) — uma nova qualificação cria NOVA oportunidade.
// Confiança simples: derivada da urgência do lead (Alta→alta, Média→média, Baixa→baixa).
onRecordAfterUpdateSuccess((e) => {
  const r = e.record
  const virouQualificado =
    r.getString('status') === 'qualificado' && r.original().getString('status') !== 'qualificado'
  if (!virouQualificado) return

  const leadId = r.id
  const produtoId = r.getString('produto_interesse')
  const justificativa =
    r.getString('qualificacao_resultado') ||
    'Lead qualificado: produto ativo, necessidade e urgência confirmadas.'
  const urgencia = r.getString('urgencia')
  const confianca = urgencia === 'Alta' ? 'alta' : urgencia === 'Média' ? 'média' : 'baixa'

  try {
    // RN-1.13: oportunidade aberta existente do mesmo lead+produto → atualizar
    let existente = null
    try {
      existente = $app.findFirstRecordByFilter(
        'oportunidades',
        "lead = {:lead} && produto = {:produto} && (status = 'Sugerida' || status = 'Em revisão')",
        { lead: leadId, produto: produtoId },
      )
    } catch (_) {
      existente = null
    }

    if (existente) {
      existente.set('justificativa', justificativa)
      existente.set('confianca', confianca)
      existente.set('atualizado_em', new Date().toISOString())
      $app.save(existente)
      return
    }

    // criar nova oportunidade sugerida
    const col = $app.findCollectionByNameOrId('oportunidades')
    const item = new Record(col)
    item.set('lead', leadId)
    item.set('produto', produtoId)
    item.set('justificativa', justificativa)
    item.set('confianca', confianca)
    item.set('status', 'Sugerida')
    item.set('criado_em', new Date().toISOString())
    $app.save(item)
  } catch (err) {
    // não bloqueia a qualificação: falha na fila é registrada, não impede o lead
    $app.logger().warn('F1-T13: oportunidade não criada/atualizada', {
      leadId,
      produtoId,
      err: String(err),
    })
  }
}, 'leads')
