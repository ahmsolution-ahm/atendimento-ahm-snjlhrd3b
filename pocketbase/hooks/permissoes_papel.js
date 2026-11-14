// Fase 2 · Bloco 3 (F2-T11) — permissões por papel (admin | vendedor).
// O papel vem SEMPRE do registro do usuário no banco (e.auth é recarregado a cada requisição a
// partir do token), nunca de um valor enviado pelo cliente. Conta de superusuário = administrador.
// Camada ADICIONAL: a proteção PROVA/DEMO (protecao_exclusao.js) continua valendo para todos —
// uma exclusão precisa passar pelas duas.
// Obs.: lógica inteira dentro de cada callback (o JSVM não enxerga funções de topo).

// 1) Exclusão física: só administrador.
onRecordDeleteRequest(
  (e) => {
    const admin =
      e.hasSuperuserAuth() ||
      (!!e.auth && e.auth.collection().name === 'users' && e.auth.getString('papel') === 'admin')
    if (!admin) {
      throw new ForbiddenError('A exclusão de registros é restrita ao administrador.')
    }
    return e.next()
  },
  'leads',
  'oportunidades',
  'transbordos',
  'interacoes',
  'oportunidade_etapas',
  'etapa_checklist_respostas',
  'etapa_checklist_itens',
  'pipeline_etapas',
  'produtos',
  'modelos_negocio',
  'templates_diagnostico',
  'tickets',
  'atendimentos',
  'comentarios',
  'logs_tickets',
  'motivos_perda',
  'configuracoes',
)

// 2) Catálogo de produtos e configuração do pipeline: criar/editar só administrador.
onRecordCreateRequest(
  (e) => {
    const admin =
      e.hasSuperuserAuth() ||
      (!!e.auth && e.auth.collection().name === 'users' && e.auth.getString('papel') === 'admin')
    if (!admin) {
      throw new ForbiddenError(
        e.collection.name === 'produtos'
          ? 'O catálogo de produtos só pode ser alterado por um administrador.'
          : 'Esta configuração só pode ser alterada por um administrador.',
      )
    }
    return e.next()
  },
  'produtos',
  'modelos_negocio',
  'templates_diagnostico',
  'pipeline_etapas',
  'etapa_checklist_itens',
  'motivos_perda',
  'configuracoes',
)

onRecordUpdateRequest(
  (e) => {
    const admin =
      e.hasSuperuserAuth() ||
      (!!e.auth && e.auth.collection().name === 'users' && e.auth.getString('papel') === 'admin')
    if (!admin) {
      throw new ForbiddenError(
        e.collection.name === 'produtos'
          ? 'O catálogo de produtos só pode ser alterado por um administrador.'
          : 'Esta configuração só pode ser alterada por um administrador.',
      )
    }
    return e.next()
  },
  'produtos',
  'modelos_negocio',
  'templates_diagnostico',
  'pipeline_etapas',
  'etapa_checklist_itens',
  'motivos_perda',
  'configuracoes',
)

// 3) Demonstração do painel: só administrador carrega (a remoção já exige administrador pela
//    regra de exclusão acima).
onRecordCreateRequest((e) => {
  const admin =
    e.hasSuperuserAuth() ||
    (!!e.auth && e.auth.collection().name === 'users' && e.auth.getString('papel') === 'admin')
  const r = e.record
  // palavra inteira: "DEMO —", "DEMO Empresa" sim; "Demolidora" não
  const ehDemo = (s) => /^DEMO(?![A-ZÀ-ÖØ-Þ])/.test((s || '').trim().toUpperCase())
  const demo =
    r.getString('origem') === 'Demonstração' ||
    ehDemo(r.getString('nome')) ||
    ehDemo(r.getString('empresa'))
  if (demo && !admin) {
    throw new ForbiddenError('A demonstração só pode ser carregada por um administrador.')
  }
  return e.next()
}, 'leads')

// 4) Reforço da proteção da base real: um lead existente não pode passar a ter o marcador de
//    prova/demonstração no nome ou na empresa (isso o tornaria apagável). Vale para qualquer
//    origem (model hook), inclusive scripts.
onRecordUpdate((e) => {
  // palavra inteira: "PROVA Lead" sim; "Provale" / "Demolidora" não
  const marcado = (s) => /^(PROVA|DEMO)(?![A-ZÀ-ÖØ-Þ])/.test((s || '').trim().toUpperCase())
  const r = e.record
  const o = r.original()
  const antes = marcado(o.getString('nome')) || marcado(o.getString('empresa'))
  const depois = marcado(r.getString('nome')) || marcado(r.getString('empresa'))
  if (!antes && depois) {
    throw new BadRequestError(
      'Um lead real não pode ser renomeado como registro de prova ou de demonstração.',
    )
  }
  return e.next()
}, 'leads')

// 5) Usuários.
// 5a) Papel padrão: vendedor (qualquer origem, inclusive o painel do administrador).
onRecordCreate((e) => {
  if (!e.record.getString('papel')) e.record.set('papel', 'vendedor')
  return e.next()
}, 'users')

// 5b) Cadastro de usuário: só administrador.
onRecordCreateRequest((e) => {
  const admin =
    e.hasSuperuserAuth() ||
    (!!e.auth && e.auth.collection().name === 'users' && e.auth.getString('papel') === 'admin')
  if (!admin) {
    throw new ForbiddenError('Somente um administrador pode cadastrar usuários.')
  }
  return e.next()
}, 'users')

// 5c) Troca de papel: só administrador; sempre resta ao menos um administrador.
onRecordUpdateRequest((e) => {
  const admin =
    e.hasSuperuserAuth() ||
    (!!e.auth && e.auth.collection().name === 'users' && e.auth.getString('papel') === 'admin')
  const r = e.record
  const antes = r.original().getString('papel') || 'vendedor'
  if (!r.getString('papel')) r.set('papel', antes)
  const depois = r.getString('papel')
  if (antes !== depois) {
    if (!admin) {
      throw new ForbiddenError('Somente um administrador pode alterar o papel de um usuário.')
    }
    if (antes === 'admin') {
      const admins = $app.findRecordsByFilter('users', "papel = 'admin'", '', 0, 0)
      if (admins.length <= 1) {
        throw new BadRequestError(
          'É preciso manter ao menos um administrador. Defina outro administrador antes de alterar este papel.',
        )
      }
    }
  }
  return e.next()
}, 'users')

// 5d) Exclusão de usuário: só administrador; o último administrador não pode ser excluído.
onRecordDeleteRequest((e) => {
  const admin =
    e.hasSuperuserAuth() ||
    (!!e.auth && e.auth.collection().name === 'users' && e.auth.getString('papel') === 'admin')
  if (!admin) {
    throw new ForbiddenError('Somente um administrador pode excluir usuários.')
  }
  if (e.record.getString('papel') === 'admin') {
    const admins = $app.findRecordsByFilter('users', "papel = 'admin'", '', 0, 0)
    if (admins.length <= 1) {
      throw new BadRequestError('O último administrador não pode ser excluído.')
    }
  }
  return e.next()
}, 'users')

// 6) Auditoria e histórico de fechamentos: leitura só para administrador (a regra da coleção
//    também restringe; aqui a recusa da listagem vem com mensagem clara).
onRecordsListRequest(
  (e) => {
    const admin =
      e.hasSuperuserAuth() ||
      (!!e.auth && e.auth.collection().name === 'users' && e.auth.getString('papel') === 'admin')
    if (!admin) {
      throw new ForbiddenError('O histórico de auditoria é restrito ao administrador.')
    }
    return e.next()
  },
  'exclusoes_auditoria',
  'oportunidade_fechamentos',
)

onRecordViewRequest(
  (e) => {
    const admin =
      e.hasSuperuserAuth() ||
      (!!e.auth && e.auth.collection().name === 'users' && e.auth.getString('papel') === 'admin')
    if (!admin) {
      throw new ForbiddenError('O histórico de auditoria é restrito ao administrador.')
    }
    return e.next()
  },
  'exclusoes_auditoria',
  'oportunidade_fechamentos',
)
