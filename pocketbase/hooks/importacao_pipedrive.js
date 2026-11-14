// Fase 2 · Bloco D — importação do histórico do Pipedrive (só administrador).
// POST /backend/v1/pipedrive/importar   corpo: { itens: [...], simular: true|false }
//   - itens já mapeados no navegador (src/lib/pipedrive.ts — regras aprovadas pelo owner);
//   - simular = true: NADA é gravado; devolve as contagens da prévia (aceita a planilha inteira);
//   - simular = false: grava até 500 itens por requisição, numa transação.
// Deduplicação:
//   - pipedrive_id único em oportunidades e leads → repetir a importação não duplica nada;
//   - lead: empresa + pessoa normalizadas (sem acento/maiúsculas/pontuação), contra a base
//     inteira; achou → a oportunidade se liga ao lead existente (o lead existente não é alterado).
// Leads novos entram como rascunho (a exportação do Pipedrive não traz e-mail/telefone) e
// pendentes (sem produto), com a etapa do Pipedrive registrada — nada é inventado.
// Obs.: lógica inteira dentro do callback (o JSVM não enxerga funções de topo).
routerAdd(
  'POST',
  '/backend/v1/pipedrive/importar',
  (e) => {
    const admin =
      e.hasSuperuserAuth() ||
      (!!e.auth && e.auth.collection().name === 'users' && e.auth.getString('papel') === 'admin')
    if (!admin) {
      throw new ForbiddenError(
        'A importação do histórico do Pipedrive é restrita ao administrador.',
      )
    }
    const body = e.requestInfo().body || {}
    const itens = body.itens
    const simular = body.simular === true
    if (!Array.isArray(itens))
      throw new BadRequestError('Envie a lista de negócios no campo "itens".')
    if (!simular && itens.length > 500) {
      throw new BadRequestError('Envie no máximo 500 negócios por requisição de gravação.')
    }
    if (itens.length > 15000)
      throw new BadRequestError('A planilha tem negócios demais para uma prévia.')

    // mesmo mapa de acentos de src/lib/pipedrive.ts
    const acentos = {
      á: 'a',
      à: 'a',
      â: 'a',
      ã: 'a',
      ä: 'a',
      é: 'e',
      è: 'e',
      ê: 'e',
      ë: 'e',
      í: 'i',
      ì: 'i',
      î: 'i',
      ï: 'i',
      ó: 'o',
      ò: 'o',
      ô: 'o',
      õ: 'o',
      ö: 'o',
      ú: 'u',
      ù: 'u',
      û: 'u',
      ü: 'u',
      ç: 'c',
      ñ: 'n',
    }
    const norm = (s) =>
      String(s || '')
        .toLowerCase()
        .replace(/[áàâãäéèêëíìîïóòôõöúùûüçñ]/g, (c) => acentos[c] || c)
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
    const consultar = (sql, modelo) => {
      const linhas = arrayOf(new DynamicModel(modelo))
      $app.db().newQuery(sql).all(linhas)
      return linhas
    }

    // índices da base
    const leadPorChave = {}
    const leadPorPd = {}
    const baseLeads = consultar(
      "SELECT id, COALESCE(nome, '') AS nome, COALESCE(empresa, '') AS empresa, COALESCE(pipedrive_id, '') AS pd FROM leads",
      { id: '', nome: '', empresa: '', pd: '' },
    )
    for (let i = 0; i < baseLeads.length; i++) {
      const l = baseLeads[i]
      const k = norm(l.empresa) + '|' + norm(l.nome)
      if (k !== '|' && !leadPorChave[k])
        leadPorChave[k] = { id: l.id, nome: l.nome, empresa: l.empresa }
      if (l.pd) leadPorPd[l.pd] = l.id
    }
    const opPd = {}
    const basePd = consultar(
      "SELECT pipedrive_id AS pd FROM oportunidades WHERE COALESCE(pipedrive_id, '') != ''",
      { pd: '' },
    )
    for (let i = 0; i < basePd.length; i++) opPd[basePd[i].pd] = true

    const etapaPorOrdem = {}
    const etapas = consultar(
      "SELECT id, COALESCE(ordem, 0) AS ordem FROM pipeline_etapas WHERE trilha = 'alta'",
      { id: '', ordem: 0 },
    )
    for (let i = 0; i < etapas.length; i++) etapaPorOrdem[etapas[i].ordem] = etapas[i].id

    const motivoPorNome = {}
    const motivos = consultar("SELECT id, COALESCE(nome, '') AS nome FROM motivos_perda", {
      id: '',
      nome: '',
    })
    for (let i = 0; i < motivos.length; i++) motivoPorNome[norm(motivos[i].nome)] = motivos[i].id

    // proprietário do Pipedrive → usuário do CRM (nome completo; primeiro nome único; ou
    // primeiro nome com prefixo + mesmo sobrenome). Sem correspondência → sem responsável.
    const usuarios = consultar("SELECT id, COALESCE(name, '') AS nome FROM users", {
      id: '',
      nome: '',
    })
    const cacheUsuario = {}
    const nomeUsuario = {}
    for (let i = 0; i < usuarios.length; i++) nomeUsuario[usuarios[i].id] = usuarios[i].nome
    const usuarioDe = (proprietario) => {
      const p = norm(proprietario)
      if (!p) return ''
      if (Object.prototype.hasOwnProperty.call(cacheUsuario, p)) return cacheUsuario[p]
      const pt = p.split(' ')
      const candidatos = []
      for (let i = 0; i < usuarios.length; i++) {
        const u = norm(usuarios[i].nome)
        if (!u) continue
        const ut = u.split(' ')
        if (u === p) {
          candidatos.length = 0
          candidatos.push(usuarios[i].id)
          break
        }
        const primeiroOk =
          ut[0] === pt[0] || ut[0].indexOf(pt[0]) === 0 || pt[0].indexOf(ut[0]) === 0
        const sobrenomeOk = pt.length === 1 || ut[ut.length - 1] === pt[pt.length - 1]
        if (primeiroOk && sobrenomeOk && (pt.length > 1 || ut[0] === pt[0]))
          candidatos.push(usuarios[i].id)
      }
      cacheUsuario[p] = candidatos.length === 1 ? candidatos[0] : ''
      return cacheUsuario[p]
    }

    const colLeads = $app.findCollectionByNameOrId('leads')
    const colOps = $app.findCollectionByNameOrId('oportunidades')
    const hoje = new Date().toISOString()
    const r = {
      simulacao: simular,
      recebidos: itens.length,
      oportunidadesNovas: 0,
      leadsNovos: 0,
      ligadasALeadExistente: 0,
      leadsJaNaBase: 0,
      jaImportados: 0,
      falhas: [],
      amostraLigacoes: [],
      responsaveis: {},
    }
    const chavesNovas = {} // leads que esta requisição cria (para não contar/criar duas vezes)

    const processar = (txApp) => {
      for (let i = 0; i < itens.length; i++) {
        const it = itens[i] || {}
        const id = String(it.pipedrive_id || '').trim()
        try {
          if (!id) throw new Error('Negócio sem número do Pipedrive.')
          const tipo =
            it.tipo === 'oportunidade' ? 'oportunidade' : it.tipo === 'lead' ? 'lead' : ''
          if (!tipo) throw new Error('Tipo de registro inválido.')
          if ((tipo === 'oportunidade' && opPd[id]) || (tipo === 'lead' && leadPorPd[id])) {
            r.jaImportados++
            continue
          }
          const empresa = String(it.empresa || '').trim()
          const pessoa = String(it.pessoa || '').trim()
          if (!empresa && !pessoa)
            throw new Error('Negócio sem organização e sem pessoa de contato.')
          const chave = norm(empresa || pessoa) + '|' + norm(pessoa || empresa)
          const prop = String(it.proprietario || '').trim()
          const userId = usuarioDe(prop)
          if (prop && !Object.prototype.hasOwnProperty.call(r.responsaveis, prop)) {
            r.responsaveis[prop] = userId ? nomeUsuario[userId] || 'Usuário' : null
          }
          const existente = leadPorChave[chave]

          if (tipo === 'lead') {
            if (existente || chavesNovas[chave]) {
              r.leadsJaNaBase++
              continue
            }
          }

          let leadId = existente ? existente.id : chavesNovas[chave] || ''
          if (tipo === 'oportunidade' && existente) {
            r.ligadasALeadExistente++
            if (r.amostraLigacoes.length < 25) {
              r.amostraLigacoes.push({
                pipedrive: (empresa || '—') + ' / ' + (pessoa || '—'),
                lead: existente.empresa + ' / ' + existente.nome,
              })
            }
          }

          // ---- lead novo
          if (!leadId) {
            r.leadsNovos++
            if (simular) {
              chavesNovas[chave] = 'simulado'
              leadId = 'simulado'
            } else {
              const lr = new Record(colLeads)
              lr.set('nome', pessoa || empresa)
              lr.set('empresa', empresa || pessoa)
              lr.set('contato', '')
              lr.set('incompleto', true)
              lr.set('status', 'pendente')
              lr.set('origem', 'Importação Pipedrive')
              lr.set('responsavel', userId)
              lr.set('pipedrive_criado_em', String(it.criado_em || ''))
              lr.set(
                'pipedrive_etapa',
                (
                  String(it.funil || '') +
                  ' > ' +
                  String(it.etapa || '') +
                  ' > ' +
                  String(it.status || '')
                ).slice(0, 255),
              )
              lr.set(
                'observacoes',
                'Importado do Pipedrive (negócio nº ' +
                  id +
                  (it.titulo ? ': ' + String(it.titulo) : '') +
                  '). Funil ' +
                  String(it.funil || '') +
                  ', etapa ' +
                  String(it.etapa || '') +
                  ', situação ' +
                  String(it.status || '') +
                  '. A exportação não trazia e-mail nem telefone: complete o contato para confirmar o lead.',
              )
              if (tipo === 'lead') {
                lr.set('pipedrive_id', id)
                if (it.status === 'Perdido') {
                  lr.set('arquivado', true)
                  const mot = String(it.motivo_perda || it.observacao || '').trim()
                  lr.set('arquivado_motivo', 'Perdido no Pipedrive' + (mot ? ': ' + mot : '.'))
                  lr.set('arquivado_em', String(it.fechado_em || '') || hoje)
                }
              }
              txApp.save(lr)
              leadId = lr.id
              chavesNovas[chave] = lr.id
              if (tipo === 'lead') leadPorPd[id] = lr.id
            }
          }
          if (tipo === 'lead') continue

          // ---- oportunidade
          const ordem = parseInt(it.ordem_etapa, 10)
          const etapaId = etapaPorOrdem[ordem]
          if (!etapaId)
            throw new Error('Etapa do pipeline não encontrada para a ordem ' + it.ordem_etapa + '.')
          const resultado =
            it.resultado === 'ganha' || it.resultado === 'perdida' ? it.resultado : ''
          let motivoId = ''
          if (resultado === 'perdida' && it.motivo_perda) {
            motivoId = motivoPorNome[norm(it.motivo_perda)] || ''
          }
          r.oportunidadesNovas++
          if (simular) {
            opPd[id] = true
            continue
          }
          const op = new Record(colOps)
          op.set('lead', leadId)
          op.set(
            'justificativa',
            'Negócio importado do Pipedrive (nº ' +
              id +
              (it.titulo ? ': ' + String(it.titulo) : '') +
              ').',
          )
          op.set('status', 'Aprovada')
          op.set('trilha', 'alta')
          op.set('etapa_atual', etapaId)
          op.set('etapa_desde', String(it.etapa_desde || '') || String(it.criado_em || '') || hoje)
          op.set('criado_em', String(it.criado_em || '') || hoje)
          op.set('responsavel', userId)
          const moeda = it.moeda === 'BRL' || it.moeda === 'USD' ? it.moeda : ''
          op.set('valor_estimado', moeda && Number(it.valor) > 0 ? Number(it.valor) : 0)
          op.set('moeda', moeda)
          op.set('valor_original', Number(it.valor_original) || 0)
          op.set('moeda_original', String(it.moeda_original || '').slice(0, 10))
          op.set('pipedrive_id', id)
          op.set('pipedrive_proprietario', prop.slice(0, 120))
          op.set('pipedrive_produto', String(it.produto || '').slice(0, 255))
          op.set('comentario', 'Importado do Pipedrive em ' + hoje.slice(0, 10) + '.')
          if (resultado) {
            op.set('resultado', resultado)
            op.set('fechado_em', String(it.fechado_em || '') || hoje)
            if (motivoId) op.set('motivo_perda', motivoId)
            op.set(
              'resultado_motivo',
              String(it.observacao || '') ||
                (resultado === 'ganha' ? 'Ganho registrado no Pipedrive.' : ''),
            )
          }
          txApp.save(op)
          opPd[id] = true
        } catch (err) {
          if (r.falhas.length < 200) {
            r.falhas.push({ pipedrive_id: id, motivo: String((err && err.message) || err) })
          } else {
            r.falhas.push({ pipedrive_id: id, motivo: '' })
          }
        }
      }
    }

    if (simular) processar($app)
    else $app.runInTransaction((txApp) => processar(txApp))

    r.totalFalhas = r.falhas.length
    if (r.falhas.length > 200) r.falhas = r.falhas.slice(0, 200)
    return e.json(200, r)
  },
  $apis.requireAuth(),
)
