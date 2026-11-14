// F2-T02/T03/T04 — emendas 1.2a §3 e 1.2b: pipeline de duas trilhas na oportunidade.
//
// Model hooks (qualquer origem, inclusive a criação automática a partir do lead qualificado):
//   - moeda e entidade_vendedora são DERIVADAS do ambiente_fechamento (não editáveis):
//       Venda em reais / Locação em reais → BRL + AHM Brasil; Exportação (EUA) → USD + AHM Solution Americas
//   - RN-2.1: trilha = complexidade do produto (Baixa → baixa, Alta → alta); nunca manual.
//     Oportunidade sem etapa entra na 1ª etapa da trilha. Se o produto muda de trilha, a
//     oportunidade recomeça na 1ª etapa da nova trilha.
//   - Troca de etapa (avançar ou voltar) exige ambiente de fechamento e valor estimado > 0
//     (decisão do owner); a etapa precisa pertencer à trilha da oportunidade.
//   - RN-2.2: etapa_desde registra a data de entrada na etapa atual.
// Request hook: etapa_por = quem trocou a etapa (auditoria — model hook não tem e.auth).
// After-success hooks: histórico em oportunidade_etapas (fecha a etapa anterior com saiu_em e
// abre a nova com entrou_em). Nada é apagado.
// Obs.: toda a lógica fica DENTRO dos callbacks (o JSVM não enxerga funções de topo).

// Bloco D — exceção para o histórico IMPORTADO do Pipedrive (pipedrive_id preenchido):
//   - sem ambiente de fechamento (o Pipedrive não informa venda × locação), a moeda original
//     BRL/USD é mantida e a entidade fica vazia — nada é inventado;
//   - sem produto vinculado, a trilha gravada na importação (alta — decisão do owner) é mantida.
// Para todo o resto (oportunidades criadas no CRM) as regras continuam as mesmas.
onRecordCreate((e) => {
  const r = e.record
  const importado = r.getString('pipedrive_id') !== ''

  const ambiente = r.getString('ambiente_fechamento')
  if (ambiente === 'Exportação (EUA)') {
    r.set('moeda', 'USD')
    r.set('entidade_vendedora', 'AHM Solution Americas')
  } else if (ambiente === 'Venda em reais' || ambiente === 'Locação em reais') {
    r.set('moeda', 'BRL')
    r.set('entidade_vendedora', 'AHM Brasil')
  } else if (importado && (r.getString('moeda') === 'BRL' || r.getString('moeda') === 'USD')) {
    r.set('entidade_vendedora', '')
  } else {
    r.set('moeda', '')
    r.set('entidade_vendedora', '')
  }

  let trilha = ''
  const produtoId = r.getString('produto')
  if (importado && produtoId === '') {
    const t = r.getString('trilha')
    trilha = t === 'alta' || t === 'baixa' ? t : ''
  } else if (produtoId !== '') {
    try {
      const c = $app.findRecordById('produtos', produtoId).getString('complexidade')
      trilha = c === 'Alta' ? 'alta' : c === 'Baixa' ? 'baixa' : ''
    } catch (_) {
      trilha = ''
    }
  }
  r.set('trilha', trilha)

  if (trilha === '') {
    r.set('etapa_atual', '')
    r.set('etapa_desde', '')
  } else {
    const etapaId = r.getString('etapa_atual')
    let valida = false
    if (etapaId !== '') {
      try {
        valida = $app.findRecordById('pipeline_etapas', etapaId).getString('trilha') === trilha
      } catch (_) {
        valida = false
      }
    }
    if (!valida) {
      try {
        const primeira = $app.findFirstRecordByFilter(
          'pipeline_etapas',
          'trilha = {:t} && ordem = 1',
          { t: trilha },
        )
        r.set('etapa_atual', primeira.id)
        r.set('etapa_desde', new Date().toISOString())
      } catch (_) {
        r.set('etapa_atual', '')
      }
    } else if (r.getString('etapa_desde') === '') {
      r.set('etapa_desde', new Date().toISOString())
    }
  }
  return e.next()
}, 'oportunidades')

onRecordUpdate((e) => {
  const r = e.record
  const o = r.original()
  const importado = r.getString('pipedrive_id') !== ''

  const ambiente = r.getString('ambiente_fechamento')
  if (ambiente === 'Exportação (EUA)') {
    r.set('moeda', 'USD')
    r.set('entidade_vendedora', 'AHM Solution Americas')
  } else if (ambiente === 'Venda em reais' || ambiente === 'Locação em reais') {
    r.set('moeda', 'BRL')
    r.set('entidade_vendedora', 'AHM Brasil')
  } else if (importado && (o.getString('moeda') === 'BRL' || o.getString('moeda') === 'USD')) {
    r.set('moeda', o.getString('moeda'))
    r.set('entidade_vendedora', '')
  } else {
    r.set('moeda', '')
    r.set('entidade_vendedora', '')
  }

  if (r.getFloat('valor_estimado') < 0) {
    throw new BadRequestError('O valor estimado não pode ser negativo.')
  }

  // RN-2.1: a trilha acompanha a complexidade do produto (importado sem produto: mantém a gravada)
  let trilha = ''
  const produtoId = r.getString('produto')
  if (importado && produtoId === '') {
    trilha = o.getString('trilha')
  } else if (produtoId !== '') {
    try {
      const c = $app.findRecordById('produtos', produtoId).getString('complexidade')
      trilha = c === 'Alta' ? 'alta' : c === 'Baixa' ? 'baixa' : ''
    } catch (_) {
      trilha = ''
    }
  }
  const trilhaAnterior = o.getString('trilha')
  r.set('trilha', trilha)

  const etapaAnterior = o.getString('etapa_atual')
  let etapaNova = r.getString('etapa_atual')

  if (trilha === '') {
    if (etapaNova !== '' && etapaNova !== etapaAnterior) {
      throw new BadRequestError(
        'Esta oportunidade ainda não tem trilha de pipeline: o produto precisa ter a complexidade definida no catálogo.',
      )
    }
    r.set('etapa_atual', '')
    r.set('etapa_desde', '')
    return e.next()
  }

  // produto mudou de trilha (ou a trilha foi definida agora): recomeça na 1ª etapa
  if (trilha !== trilhaAnterior) {
    try {
      const primeira = $app.findFirstRecordByFilter(
        'pipeline_etapas',
        'trilha = {:t} && ordem = 1',
        { t: trilha },
      )
      r.set('etapa_atual', primeira.id)
      r.set('etapa_desde', new Date().toISOString())
    } catch (_) {
      r.set('etapa_atual', '')
    }
    return e.next()
  }

  if (etapaNova === etapaAnterior) return e.next()

  if (etapaNova === '') {
    throw new BadRequestError('A etapa do pipeline não pode ficar vazia.')
  }
  let etapa = null
  try {
    etapa = $app.findRecordById('pipeline_etapas', etapaNova)
  } catch (_) {
    etapa = null
  }
  if (!etapa || etapa.getString('trilha') !== trilha) {
    throw new BadRequestError('A etapa escolhida não pertence à trilha desta oportunidade.')
  }

  // início do pipeline (sem etapa anterior) não exige os campos de fechamento;
  // avançar ou voltar exige (decisão do owner: valor estimado obrigatório)
  if (etapaAnterior !== '') {
    const faltando = []
    if (ambiente === '') faltando.push('o ambiente de fechamento')
    if (!(r.getFloat('valor_estimado') > 0)) faltando.push('o valor estimado')
    if (faltando.length > 0) {
      throw new BadRequestError(
        'Para mudar a oportunidade de etapa, preencha ' +
          faltando.join(' e ') +
          ' na seção Fechamento.',
      )
    }
  }
  r.set('etapa_desde', new Date().toISOString())
  return e.next()
}, 'oportunidades')

// auditoria: quem trocou a etapa (hook de requisição tem e.auth)
onRecordUpdateRequest((e) => {
  const r = e.record
  if (r.getString('etapa_atual') !== r.original().getString('etapa_atual')) {
    r.set('etapa_por', e.auth?.id || '')
  }
  return e.next()
}, 'oportunidades')

onRecordCreateRequest((e) => {
  e.record.set('etapa_por', e.auth?.id || '')
  return e.next()
}, 'oportunidades')

// RN-2.2: histórico de passagem — abre a 1ª etapa na criação.
// Bloco D: oportunidade importada do Pipedrive NÃO ganha registro de passagem (o Pipedrive não
// exporta o histórico de etapas; um registro só da etapa final distorceria as taxas de passagem).
onRecordAfterCreateSuccess((e) => {
  try {
    const r = e.record
    const etapaId = r.getString('etapa_atual')
    if (etapaId !== '' && r.getString('pipedrive_id') === '') {
      const col = $app.findCollectionByNameOrId('oportunidade_etapas')
      const h = new Record(col)
      h.set('oportunidade', r.id)
      h.set('etapa', etapaId)
      h.set('entrou_em', r.getString('etapa_desde') || new Date().toISOString())
      h.set('responsavel', r.getString('etapa_por'))
      $app.save(h)
    }
  } catch (err) {
    $app.logger().warn('Pipeline: histórico de etapa não registrado na criação', {
      err: String(err),
    })
  } finally {
    e.next()
  }
}, 'oportunidades')

// RN-2.2: histórico de passagem — fecha a etapa anterior e abre a nova
onRecordAfterUpdateSuccess((e) => {
  try {
    const r = e.record
    const etapaNova = r.getString('etapa_atual')
    const etapaAnterior = r.original().getString('etapa_atual')
    if (etapaNova !== etapaAnterior) {
      const agora = new Date().toISOString()
      const abertas = $app.findRecordsByFilter(
        'oportunidade_etapas',
        "oportunidade = {:id} && saiu_em = ''",
        '',
        50,
        0,
        { id: r.id },
      )
      for (let i = 0; i < abertas.length; i++) {
        abertas[i].set('saiu_em', agora)
        $app.save(abertas[i])
      }
      if (etapaNova !== '') {
        const col = $app.findCollectionByNameOrId('oportunidade_etapas')
        const h = new Record(col)
        h.set('oportunidade', r.id)
        h.set('etapa', etapaNova)
        h.set('entrou_em', r.getString('etapa_desde') || agora)
        h.set('responsavel', r.getString('etapa_por'))
        $app.save(h)
      }
    }
  } catch (err) {
    $app.logger().warn('Pipeline: histórico de etapa não registrado na troca', {
      err: String(err),
    })
  } finally {
    e.next()
  }
}, 'oportunidades')
