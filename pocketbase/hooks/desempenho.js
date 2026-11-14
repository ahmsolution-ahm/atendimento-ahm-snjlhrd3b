// Fase 2 · Bloco C (F2-T13) — responsável da oportunidade e indicadores de Desempenho.
// Obs.: lógica inteira dentro de cada callback (o JSVM não enxerga funções de topo).

// 1) Responsável herdado do lead na criação (qualquer origem: motor de qualificação,
//    demonstração, script). Lead sem responsável → oportunidade sem responsável (honesto).
onRecordCreate((e) => {
  const r = e.record
  if (!r.getString('responsavel') && r.getString('lead')) {
    try {
      const lead = $app.findRecordById('leads', r.getString('lead'))
      const resp = lead.getString('responsavel')
      if (resp) r.set('responsavel', resp)
    } catch (_) {
      /* lead indisponível: segue sem responsável */
    }
  }
  return e.next()
}, 'oportunidades')

// 2) Troca de responsável: só administrador (o papel vem do registro no banco).
onRecordUpdateRequest((e) => {
  const admin =
    e.hasSuperuserAuth() ||
    (!!e.auth && e.auth.collection().name === 'users' && e.auth.getString('papel') === 'admin')
  const r = e.record
  if (!admin && r.getString('responsavel') !== r.original().getString('responsavel')) {
    throw new ForbiddenError('Somente um administrador pode alterar o responsável da oportunidade.')
  }
  return e.next()
}, 'oportunidades')

// 3) Indicadores da tela Desempenho — agregados no servidor (nunca carrega a base inteira).
// Entrada (query, valores fixos; o resto é recusado):
//   periodo = mes | 3m | 6m | 12m | todos (meses-calendário, contando o atual)
//   trilha = todas | alta | baixa
//   responsavel = todos | sem | <id>  — para vendedor o servidor FORÇA o próprio id.
// Regras de cálculo (espelhadas na documentação do bloco):
//   - criadas: pela data de criação da oportunidade; ganhas/perdidas: pela data do fechamento;
//     abertas e "em negociação": foto atual (sem período).
//   - aberta = sem resultado e não rejeitada. Em negociação = etapa "Negociação (prova de
//     conceito)" (alta, ordem 5) ou "Proposta Customizada" (baixa, ordem 3).
//   - valores sempre por moeda (BRL e USD separados, nunca somados); oportunidade sem moeda
//     conta na quantidade e aparece como "sem valor definido".
//   - dados de demonstração (lead com origem Demonstração) não entram.
routerAdd(
  'GET',
  '/backend/v1/desempenho',
  (e) => {
    const admin =
      e.hasSuperuserAuth() ||
      (!!e.auth && e.auth.collection().name === 'users' && e.auth.getString('papel') === 'admin')
    const q = e.request.url.query()
    const periodo = q.get('periodo') || '12m'
    const trilha = q.get('trilha') || 'todas'
    let resp = q.get('responsavel') || 'todos'

    const mesesAtras = { mes: 0, '3m': 2, '6m': 5, '12m': 11, todos: -1 }
    if (!Object.prototype.hasOwnProperty.call(mesesAtras, periodo)) {
      throw new BadRequestError('Período inválido para o cálculo do desempenho.')
    }
    if (['todas', 'alta', 'baixa'].indexOf(trilha) < 0) {
      throw new BadRequestError('Trilha inválida para o cálculo do desempenho.')
    }
    if (!admin) resp = e.auth ? e.auth.id : 'ninguem'
    if (resp !== 'todos' && resp !== 'sem' && !/^[a-z0-9]{15}$/.test(resp)) {
      throw new BadRequestError('Responsável inválido para o cálculo do desempenho.')
    }

    const agora = new Date()
    let inicio = ''
    if (mesesAtras[periodo] >= 0) {
      const d = new Date(
        Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - mesesAtras[periodo], 1),
      )
      inicio = d.toISOString().slice(0, 10) + ' 00:00:00.000Z'
    }
    const params = { trilha: trilha, resp: resp, inicio: inicio }

    // filtros base sobre oportunidades (alias o)
    let baseSemResp =
      "o.lead NOT IN (SELECT id FROM leads WHERE COALESCE(origem, '') = 'Demonstração')"
    if (trilha !== 'todas') baseSemResp += ' AND o.trilha = {:trilha}'
    let base = baseSemResp
    if (resp === 'sem') base += " AND COALESCE(o.responsavel, '') = ''"
    else if (resp !== 'todos') base += ' AND o.responsavel = {:resp}'
    const aberta = " AND COALESCE(o.resultado, '') = '' AND o.status != 'Rejeitada'"
    const criadaNoPeriodo = inicio ? ' AND o.created >= {:inicio}' : ''
    const fechadaNoPeriodo =
      " AND COALESCE(o.fechado_em, '') != ''" + (inicio ? ' AND o.fechado_em >= {:inicio}' : '')

    const consultar = (sql, modelo) => {
      const linhas = arrayOf(new DynamicModel(modelo))
      $app.db().newQuery(sql).bind(params).all(linhas)
      return linhas
    }
    const reais = (centavos) => Math.round(centavos) / 100

    // etapas do pipeline
    const etapasLinhas = consultar(
      'SELECT id, trilha, ordem, nome, fase FROM pipeline_etapas ORDER BY trilha, ordem',
      { id: '', trilha: '', ordem: 0, nome: '', fase: '' },
    )
    const etapaPorId = {}
    const etapasFiltradas = []
    for (let i = 0; i < etapasLinhas.length; i++) {
      const et = etapasLinhas[i]
      etapaPorId[et.id] = {
        id: et.id,
        trilha: et.trilha,
        ordem: et.ordem,
        nome: et.nome,
        fase: et.fase,
      }
      if (trilha === 'todas' || et.trilha === trilha) etapasFiltradas.push(etapaPorId[et.id])
    }
    const ehNegociacao = (et) =>
      !!et &&
      ((et.trilha === 'alta' && et.ordem === 5) || (et.trilha === 'baixa' && et.ordem === 3))

    // ---- abertas por etapa (foto atual)
    const abertasLinhas = consultar(
      "SELECT COALESCE(o.etapa_atual, '') AS etapa, COALESCE(o.moeda, '') AS moeda, COUNT(*) AS n, " +
        'CAST(ROUND(SUM(COALESCE(o.valor_estimado, 0)) * 100) AS INTEGER) AS c ' +
        'FROM oportunidades o WHERE ' +
        base +
        aberta +
        ' GROUP BY 1, 2',
      { etapa: '', moeda: '', n: 0, c: 0 },
    )
    const porEtapa = {}
    const totalAbertas = { qtd: 0, BRL: 0, USD: 0, semValor: 0 }
    const negociacao = { qtd: 0, BRL: 0, USD: 0, semValor: 0 }
    for (let i = 0; i < abertasLinhas.length; i++) {
      const l = abertasLinhas[i]
      const chave = l.etapa || 'nao_iniciado'
      if (!porEtapa[chave]) porEtapa[chave] = { qtd: 0, BRL: 0, USD: 0, semValor: 0 }
      const alvo = [porEtapa[chave], totalAbertas]
      if (ehNegociacao(etapaPorId[l.etapa])) alvo.push(negociacao)
      for (let j = 0; j < alvo.length; j++) {
        alvo[j].qtd += l.n
        if (l.moeda === 'BRL' || l.moeda === 'USD') alvo[j][l.moeda] += reais(l.c)
        else alvo[j].semValor += l.n
      }
    }
    const abertasPorEtapa = []
    for (let i = 0; i < etapasFiltradas.length; i++) {
      const et = etapasFiltradas[i]
      const v = porEtapa[et.id] || { qtd: 0, BRL: 0, USD: 0, semValor: 0 }
      abertasPorEtapa.push({
        etapaId: et.id,
        trilha: et.trilha,
        ordem: et.ordem,
        nome: et.nome,
        fase: et.fase,
        negociacao: ehNegociacao(et),
        qtd: v.qtd,
        BRL: v.BRL,
        USD: v.USD,
        semValor: v.semValor,
      })
    }
    const naoIniciadas = porEtapa['nao_iniciado'] || { qtd: 0, BRL: 0, USD: 0, semValor: 0 }

    // ---- lista "em negociação" (até 50, maiores valores primeiro)
    const negLinhas = consultar(
      "SELECT o.id AS id, COALESCE(l.nome, '') AS lead, COALESCE(l.empresa, '') AS empresa, " +
        "COALESCE(o.moeda, '') AS moeda, CAST(ROUND(COALESCE(o.valor_estimado, 0) * 100) AS INTEGER) AS c, " +
        "COALESCE(o.etapa_atual, '') AS etapa, COALESCE(o.responsavel, '') AS responsavel, " +
        "COALESCE(o.etapa_desde, '') AS desde " +
        'FROM oportunidades o LEFT JOIN leads l ON l.id = o.lead WHERE ' +
        base +
        aberta +
        " AND o.etapa_atual IN (SELECT id FROM pipeline_etapas WHERE (trilha = 'alta' AND ordem = 5) OR (trilha = 'baixa' AND ordem = 3))" +
        ' ORDER BY COALESCE(o.valor_estimado, 0) DESC LIMIT 50',
      { id: '', lead: '', empresa: '', moeda: '', c: 0, etapa: '', responsavel: '', desde: '' },
    )

    // nomes de usuários (cache)
    const nomes = {}
    const nomeUsuario = (id) => {
      if (!id) return 'Sem responsável'
      if (nomes[id]) return nomes[id]
      let nome = 'Usuário removido'
      try {
        const u = $app.findRecordById('users', id)
        nome = u.getString('name') || u.getString('email') || 'Usuário sem nome'
      } catch (_) {
        nome = 'Usuário removido'
      }
      nomes[id] = nome
      return nome
    }

    const emNegociacao = []
    for (let i = 0; i < negLinhas.length; i++) {
      const l = negLinhas[i]
      emNegociacao.push({
        id: l.id,
        lead: l.lead,
        empresa: l.empresa,
        moeda: l.moeda,
        valor: reais(l.c),
        etapa: etapaPorId[l.etapa] ? etapaPorId[l.etapa].nome : '',
        responsavel: nomeUsuario(l.responsavel),
        desde: l.desde,
      })
    }

    // ---- meses do período
    const mesesSet = {}
    const criadasLinhas = consultar(
      'SELECT substr(o.created, 1, 7) AS mes, COUNT(*) AS n FROM oportunidades o WHERE ' +
        base +
        criadaNoPeriodo +
        ' GROUP BY 1',
      { mes: '', n: 0 },
    )
    const ganhasLinhas = consultar(
      "SELECT substr(o.fechado_em, 1, 7) AS mes, COALESCE(o.moeda, '') AS moeda, COUNT(*) AS n, " +
        'CAST(ROUND(SUM(COALESCE(o.valor_estimado, 0)) * 100) AS INTEGER) AS c ' +
        'FROM oportunidades o WHERE ' +
        base +
        " AND o.resultado = 'ganha'" +
        fechadaNoPeriodo +
        ' GROUP BY 1, 2',
      { mes: '', moeda: '', n: 0, c: 0 },
    )
    const mesAtual = agora.toISOString().slice(0, 7)
    let primeiroMes = inicio ? inicio.slice(0, 7) : mesAtual
    if (!inicio) {
      for (let i = 0; i < criadasLinhas.length; i++)
        if (criadasLinhas[i].mes && criadasLinhas[i].mes < primeiroMes)
          primeiroMes = criadasLinhas[i].mes
      for (let i = 0; i < ganhasLinhas.length; i++)
        if (ganhasLinhas[i].mes && ganhasLinhas[i].mes < primeiroMes)
          primeiroMes = ganhasLinhas[i].mes
    }
    const meses = []
    let ano = parseInt(primeiroMes.slice(0, 4), 10)
    let mes = parseInt(primeiroMes.slice(5, 7), 10)
    let guarda = 0
    while (guarda < 240) {
      const chave = ano + '-' + (mes < 10 ? '0' + mes : '' + mes)
      meses.push(chave)
      mesesSet[chave] = true
      if (chave >= mesAtual) break
      mes++
      if (mes > 12) {
        mes = 1
        ano++
      }
      guarda++
    }

    let meta = 0
    const metaLinhas = consultar(
      "SELECT CAST(ROUND(COALESCE(valor_numero, 0)) AS INTEGER) AS v FROM configuracoes WHERE chave = 'meta_negocios_criados_mes' LIMIT 1",
      { v: 0 },
    )
    if (metaLinhas.length > 0) meta = metaLinhas[0].v

    const criadasPorMesMap = {}
    let totalCriadas = 0
    for (let i = 0; i < criadasLinhas.length; i++) {
      criadasPorMesMap[criadasLinhas[i].mes] = criadasLinhas[i].n
      totalCriadas += criadasLinhas[i].n
    }
    const ganhasPorMesMap = {}
    const totalGanhas = { qtd: 0, BRL: 0, USD: 0, qtdBRL: 0, qtdUSD: 0, semValor: 0 }
    for (let i = 0; i < ganhasLinhas.length; i++) {
      const l = ganhasLinhas[i]
      if (!ganhasPorMesMap[l.mes]) ganhasPorMesMap[l.mes] = { qtd: 0, BRL: 0, USD: 0 }
      ganhasPorMesMap[l.mes].qtd += l.n
      totalGanhas.qtd += l.n
      if (l.moeda === 'BRL' || l.moeda === 'USD') {
        ganhasPorMesMap[l.mes][l.moeda] += reais(l.c)
        totalGanhas[l.moeda] += reais(l.c)
        totalGanhas['qtd' + l.moeda] += l.n
      } else {
        totalGanhas.semValor += l.n
      }
    }
    const porMes = []
    for (let i = 0; i < meses.length; i++) {
      const m = meses[i]
      const g = ganhasPorMesMap[m] || { qtd: 0, BRL: 0, USD: 0 }
      porMes.push({
        mes: m,
        criadas: criadasPorMesMap[m] || 0,
        meta: meta,
        ganhas: g.qtd,
        ganhasBRL: g.BRL,
        ganhasUSD: g.USD,
      })
    }

    // ---- perdas
    const perdasEtapaLinhas = consultar(
      "SELECT COALESCE(o.etapa_atual, '') AS chave, COUNT(*) AS n FROM oportunidades o WHERE " +
        base +
        " AND o.resultado = 'perdida'" +
        fechadaNoPeriodo +
        ' GROUP BY 1',
      { chave: '', n: 0 },
    )
    let totalPerdidas = 0
    const perdasPorEtapa = []
    for (let i = 0; i < perdasEtapaLinhas.length; i++) {
      const l = perdasEtapaLinhas[i]
      totalPerdidas += l.n
      const et = etapaPorId[l.chave]
      perdasPorEtapa.push({
        nome: et ? et.nome : 'Antes de iniciar o pipeline',
        trilha: et ? et.trilha : '',
        ordem: et ? et.ordem : 0,
        qtd: l.n,
      })
    }
    perdasPorEtapa.sort((a, b) =>
      a.trilha === b.trilha ? a.ordem - b.ordem : a.trilha < b.trilha ? -1 : 1,
    )

    const motivosLinhas = consultar('SELECT id, nome FROM motivos_perda', { id: '', nome: '' })
    const nomeMotivo = {}
    for (let i = 0; i < motivosLinhas.length; i++)
      nomeMotivo[motivosLinhas[i].id] = motivosLinhas[i].nome
    const perdasMotivoLinhas = consultar(
      "SELECT COALESCE(o.motivo_perda, '') AS chave, COUNT(*) AS n FROM oportunidades o WHERE " +
        base +
        " AND o.resultado = 'perdida'" +
        fechadaNoPeriodo +
        ' GROUP BY 1 ORDER BY 2 DESC',
      { chave: '', n: 0 },
    )
    const perdasPorMotivo = []
    for (let i = 0; i < perdasMotivoLinhas.length; i++) {
      const l = perdasMotivoLinhas[i]
      perdasPorMotivo.push({
        motivo: l.chave
          ? nomeMotivo[l.chave] || 'Motivo removido'
          : 'Sem classificação (anterior à lista)',
        semClassificacao: !l.chave,
        qtd: l.n,
      })
    }

    // ---- duração
    const duracaoLinhas = consultar(
      'SELECT o.resultado AS resultado, COUNT(*) AS n, ' +
        'CAST(ROUND(AVG(julianday(o.fechado_em) - julianday(o.created)) * 10) AS INTEGER) AS d ' +
        'FROM oportunidades o WHERE ' +
        base +
        " AND o.resultado IN ('ganha', 'perdida')" +
        fechadaNoPeriodo +
        ' GROUP BY 1',
      { resultado: '', n: 0, d: 0 },
    )
    const duracao = { ganhas: null, perdidas: null, qtdGanhas: 0, qtdPerdidas: 0 }
    for (let i = 0; i < duracaoLinhas.length; i++) {
      const l = duracaoLinhas[i]
      if (l.resultado === 'ganha') {
        duracao.ganhas = l.d / 10
        duracao.qtdGanhas = l.n
      } else if (l.resultado === 'perdida') {
        duracao.perdidas = l.d / 10
        duracao.qtdPerdidas = l.n
      }
    }
    const tempoEtapaLinhas = consultar(
      'SELECT h.etapa AS chave, COUNT(*) AS n, ' +
        'CAST(ROUND(AVG(julianday(h.saiu_em) - julianday(h.entrou_em)) * 10) AS INTEGER) AS d ' +
        'FROM oportunidade_etapas h JOIN oportunidades o ON o.id = h.oportunidade WHERE ' +
        base +
        " AND COALESCE(h.saiu_em, '') != ''" +
        (inicio ? ' AND h.entrou_em >= {:inicio}' : '') +
        ' GROUP BY 1',
      { chave: '', n: 0, d: 0 },
    )
    const tempoMap = {}
    for (let i = 0; i < tempoEtapaLinhas.length; i++)
      tempoMap[tempoEtapaLinhas[i].chave] = tempoEtapaLinhas[i]
    const tempoPorEtapa = []
    for (let i = 0; i < etapasFiltradas.length; i++) {
      const et = etapasFiltradas[i]
      const t = tempoMap[et.id]
      tempoPorEtapa.push({
        nome: et.nome,
        trilha: et.trilha,
        ordem: et.ordem,
        dias: t ? t.d / 10 : null,
        passagens: t ? t.n : 0,
      })
    }

    // ---- funil pré-venda → comercial
    let baseLead = "COALESCE(l.origem, '') != 'Demonstração' AND COALESCE(l.incompleto, 0) = 0"
    if (resp === 'sem') baseLead += " AND COALESCE(l.responsavel, '') = ''"
    else if (resp !== 'todos') baseLead += ' AND l.responsavel = {:resp}'
    if (inicio) baseLead += ' AND l.created >= {:inicio}'
    const leadsLinhas = consultar(
      "SELECT COUNT(*) AS recebidos, COALESCE(SUM(CASE WHEN l.status = 'qualificado' THEN 1 ELSE 0 END), 0) AS qualificados " +
        'FROM leads l WHERE ' +
        baseLead,
      { recebidos: 0, qualificados: 0 },
    )
    const funilOpLinhas = consultar(
      'SELECT COUNT(*) AS criadas, ' +
        "COALESCE(SUM(CASE WHEN o.status = 'Aprovada' THEN 1 ELSE 0 END), 0) AS aprovadas, " +
        'COALESCE(SUM(CASE WHEN EXISTS (SELECT 1 FROM oportunidade_etapas h JOIN pipeline_etapas p ON p.id = h.etapa ' +
        "WHERE h.oportunidade = o.id AND p.fase IN ('Venda', 'Pós-venda')) THEN 1 ELSE 0 END), 0) AS venda, " +
        "COALESCE(SUM(CASE WHEN o.resultado = 'ganha' THEN 1 ELSE 0 END), 0) AS ganhas " +
        'FROM oportunidades o WHERE ' +
        base +
        criadaNoPeriodo,
      { criadas: 0, aprovadas: 0, venda: 0, ganhas: 0 },
    )
    const fl = leadsLinhas[0] || { recebidos: 0, qualificados: 0 }
    const fo = funilOpLinhas[0] || { criadas: 0, aprovadas: 0, venda: 0, ganhas: 0 }
    const funil = [
      { etapa: 'Leads recebidos', qtd: fl.recebidos },
      { etapa: 'Leads qualificados', qtd: fl.qualificados },
      { etapa: 'Oportunidades criadas', qtd: fo.criadas },
      { etapa: 'Oportunidades aprovadas', qtd: fo.aprovadas },
      { etapa: 'Chegaram à fase de venda', qtd: fo.venda },
      { etapa: 'Ganhas', qtd: fo.ganhas },
    ]

    // ---- por responsável (só administrador; ignora o filtro de responsável)
    let porResponsavel = []
    if (admin) {
      const linhasCriadas = consultar(
        "SELECT COALESCE(o.responsavel, '') AS chave, COUNT(*) AS n FROM oportunidades o WHERE " +
          baseSemResp +
          criadaNoPeriodo +
          ' GROUP BY 1',
        { chave: '', n: 0 },
      )
      const linhasAbertas = consultar(
        "SELECT COALESCE(o.responsavel, '') AS chave, COUNT(*) AS n FROM oportunidades o WHERE " +
          baseSemResp +
          aberta +
          ' GROUP BY 1',
        { chave: '', n: 0 },
      )
      const linhasFechadas = consultar(
        "SELECT COALESCE(o.responsavel, '') AS chave, o.resultado AS resultado, COALESCE(o.moeda, '') AS moeda, " +
          'COUNT(*) AS n, CAST(ROUND(SUM(COALESCE(o.valor_estimado, 0)) * 100) AS INTEGER) AS c ' +
          'FROM oportunidades o WHERE ' +
          baseSemResp +
          " AND o.resultado IN ('ganha', 'perdida')" +
          fechadaNoPeriodo +
          ' GROUP BY 1, 2, 3',
        { chave: '', resultado: '', moeda: '', n: 0, c: 0 },
      )
      const mapa = {}
      const pegar = (chave) => {
        if (!mapa[chave])
          mapa[chave] = {
            id: chave,
            nome: nomeUsuario(chave),
            criadas: 0,
            abertas: 0,
            ganhas: 0,
            perdidas: 0,
            ganhoBRL: 0,
            ganhoUSD: 0,
          }
        return mapa[chave]
      }
      for (let i = 0; i < linhasCriadas.length; i++)
        pegar(linhasCriadas[i].chave).criadas += linhasCriadas[i].n
      for (let i = 0; i < linhasAbertas.length; i++)
        pegar(linhasAbertas[i].chave).abertas += linhasAbertas[i].n
      for (let i = 0; i < linhasFechadas.length; i++) {
        const l = linhasFechadas[i]
        const p = pegar(l.chave)
        if (l.resultado === 'ganha') {
          p.ganhas += l.n
          if (l.moeda === 'BRL') p.ganhoBRL += reais(l.c)
          if (l.moeda === 'USD') p.ganhoUSD += reais(l.c)
        } else {
          p.perdidas += l.n
        }
      }
      porResponsavel = Object.keys(mapa).map((k) => {
        const p = mapa[k]
        const fechadas = p.ganhas + p.perdidas
        p.taxaVitoria = fechadas > 0 ? Math.round((p.ganhas / fechadas) * 1000) / 10 : null
        return p
      })
      porResponsavel.sort((a, b) => b.ganhas - a.ganhas || b.criadas - a.criadas)
    }

    const fechadasTotal = totalGanhas.qtd + totalPerdidas
    return e.json(200, {
      filtros: {
        periodo: periodo,
        trilha: trilha,
        responsavel: resp,
        inicio: inicio,
        admin: admin,
      },
      abertas: totalAbertas,
      naoIniciadas: naoIniciadas,
      abertasPorEtapa: abertasPorEtapa,
      negociacao: negociacao,
      emNegociacao: emNegociacao,
      meta: meta,
      totalCriadas: totalCriadas,
      porMes: porMes,
      ganhas: totalGanhas,
      perdidas: totalPerdidas,
      taxaVitoria:
        fechadasTotal > 0 ? Math.round((totalGanhas.qtd / fechadasTotal) * 1000) / 10 : null,
      ticketMedio: {
        BRL:
          totalGanhas.qtdBRL > 0
            ? Math.round((totalGanhas.BRL / totalGanhas.qtdBRL) * 100) / 100
            : null,
        USD:
          totalGanhas.qtdUSD > 0
            ? Math.round((totalGanhas.USD / totalGanhas.qtdUSD) * 100) / 100
            : null,
      },
      perdasPorEtapa: perdasPorEtapa,
      perdasPorMotivo: perdasPorMotivo,
      duracao: duracao,
      tempoPorEtapa: tempoPorEtapa,
      funil: funil,
      porResponsavel: porResponsavel,
    })
  },
  $apis.requireAuth(),
)
