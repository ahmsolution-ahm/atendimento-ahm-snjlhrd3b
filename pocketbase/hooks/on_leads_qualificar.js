// F1-T07 — SPEC 1.3: hook de qualificação — valida o processamento vindo do frontend.
// O motor de regras roda no frontend (src/lib/qualificacao.ts) e envia o resultado;
// este hook garante a auditoria: resultado e pendências sempre gravados juntos,
// qualificado_em/por preenchidos quando o status vira qualificado.
// F1-T07 — SPEC 1.3: hook de qualificação — auditoria do processamento.
// O motor de regras roda no frontend (src/lib/qualificacao.ts); este hook garante:
// (1) estados de qualificação exigem justificativa gravada (auditável);
// (2) qualificado preenche qualificado_em/por automaticamente.
// Nota: o PATCH do frontend sempre envia qualificacao_resultado junto com o status —
// a checagem usa o record original + o payload (original não tem o novo valor ainda).
onRecordUpdate((e) => {
  const r = e.record
  const status = r.getString('status')
  const resultado = r.getString('qualificacao_resultado')

  // se o status é um estado de qualificação, exige justificativa (auditável)
  const estadosQualificacao = ['qualificado', 'fora do recorte', 'transbordo']
  if (estadosQualificacao.includes(status) && resultado === '') {
    throw new BadRequestError(
      'Qualificação sem justificativa não é permitida (SPEC 1.3): o resultado precisa ser auditável.',
    )
  }

  // auditoria de quem qualificou
  if (status === 'qualificado') {
    if (r.getString('qualificado_em') === '') {
      r.set('qualificado_em', new Date().toISOString().replace('T', ' ').replace('Z', 'Z'))
      r.set('qualificado_por', e.auth?.id || r.getString('responsavel'))
    }

    // F1-T09: bloquear qualificação com produto inexistente ou inativo (SPEC 1.3:
    // qualificação bloqueia produto inválido SEM apagar o lead — o erro não toca nos dados)
    const produtoId = r.getString('produto_interesse')
    if (produtoId === '') {
      throw new BadRequestError(
        'Lead sem produto de interesse não pode ser qualificado (RN-1.6). Selecione um produto ativo ou mantenha o lead como pendente.',
      )
    }
    let produto = null
    try {
      produto = $app.findRecordById('produtos', produtoId)
    } catch (_) {
      throw new BadRequestError(
        'Produto de interesse não existe no catálogo. Edite o lead e selecione um produto ativo (o lead não foi alterado).',
      )
    }
    if (produto.getString('status') !== 'Ativo') {
      throw new BadRequestError(
        `Produto "${produto.getString('nome')}" está inativo no catálogo. Edite o lead e selecione um produto ativo (o lead não foi alterado).`,
      )
    }
  }

  // F1-T10 — SPEC 1.4 RN-1.11: qualificação marcando transbordo cria o item na fila
  // automaticamente (uma vez por transição para transbordo; reabrir a fila é manual).
  const statusAnterior = r.original().getString('status')
  if (status === 'transbordo' && statusAnterior !== 'transbordo') {
    const produtoId = r.getString('produto_interesse')
    let produtoNome = ''
    let especialistaId = ''
    if (produtoId !== '') {
      try {
        const p = $app.findRecordById('produtos', produtoId)
        produtoNome = p.getString('nome')
        especialistaId = p.getString('especialista')
      } catch (_) {
        produtoNome = ''
      }
    }
    const motivo = r.getString('qualificacao_resultado') || 'dúvida técnica exige especialista'
    const jaExiste = (() => {
      try {
        $app.findFirstRecordByFilter('transbordos', "lead = {:lead} && status != 'Resolvido'", {
          lead: r.id,
        })
        return true
      } catch (_) {
        return false
      }
    })()
    if (!jaExiste) {
      const col = $app.findCollectionByNameOrId('transbordos')
      const item = new Record(col)
      item.set('lead', r.id)
      item.set('produto', produtoId)
      item.set('motivo', motivo)
      item.set('especialista', especialistaId)
      item.set('status', especialistaId !== '' ? 'Aberto' : 'Pendente atribuição')
      item.set(
        'comentario',
        `produto: ${produtoNome || 'não informado'} — criado pela qualificação`,
      )
      $app.save(item)
    }
  }

  e.next()
}, 'leads')
