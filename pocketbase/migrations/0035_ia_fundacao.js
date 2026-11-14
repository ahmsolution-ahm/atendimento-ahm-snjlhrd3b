// IA de vendas · F0.1–F0.5 — fundação (briefing 06_notas/briefing-f0-f1-ia-captura.md,
// autorizado pelo owner). Nenhuma dependência externa; a conexão com o Microsoft 365 é a F0.6.
// 1) base_conhecimento — conhecimento da AHM que a IA pode usar. Fonte OBRIGATÓRIA (sem fonte,
//    a IA não usa — emenda 1.3a). Leitura e escrita só administrador; a IA lê no servidor.
// 2) regras_roteamento — modelo de negócio → vendedor (editável pelo owner, sem deploy).
//    Semente: Assinatura e Cíclico → Julio; Pontual → Paulo, INATIVA e "aguardando cadastro"
//    até a conta existir. Locação e Consultoria ficam sem regra (o owner não definiu) — o lead
//    sem regra vai para a fila do administrador.
// 3) janelas_executivo — janelas PREFERIDAS de atendimento por executivo. Os horários oferecidos
//    ao cliente = janelas ∩ agenda real do Outlook (função hooks/lib/horarios.js); sem agenda,
//    nenhum horário é oferecido.
// 4) ia_envios — auditoria de todo envio da IA (rascunho, aprovado, enviado, falha...). Escrita
//    só pelo servidor (as requisições recebem 403 no hook ia_fundacao.js).
// 5) configuracoes.valor_texto + chave ia_modo = desligada | rascunho | automatica
//    (padrão rascunho: nada sai sem clique humano). Só administrador altera.
// Regras de coleção: leitura administrativa; as escritas permitidas passam pelos hooks
// (403 com mensagem clara — padrão do Bloco 3).
// Down: remove coleções, campo e chave.
migrate(
  (app) => {
    const AUTH = "@request.auth.id != ''"
    const ADMIN = "@request.auth.papel = 'admin'"
    const users = app.findCollectionByNameOrId('users')
    const produtos = app.findCollectionByNameOrId('produtos')
    const modelos = app.findCollectionByNameOrId('modelos_negocio')
    const leads = app.findCollectionByNameOrId('leads')
    const ops = app.findCollectionByNameOrId('oportunidades')

    const base = new Collection({
      name: 'base_conhecimento',
      type: 'base',
      listRule: ADMIN,
      viewRule: ADMIN,
      createRule: AUTH,
      updateRule: AUTH,
      deleteRule: AUTH,
      fields: [
        {
          name: 'tipo',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: [
            'produto',
            'metodologia',
            'caso',
            'pergunta_frequente',
            'material',
            'especialista',
          ],
        },
        { name: 'titulo', type: 'text', required: true, max: 200 },
        { name: 'conteudo', type: 'text', required: true },
        {
          name: 'produto',
          type: 'relation',
          collectionId: produtos.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'familia', type: 'text', max: 120 },
        { name: 'fonte', type: 'text', required: true, max: 500 },
        { name: 'ativo', type: 'bool' },
        {
          name: 'criado_por',
          type: 'relation',
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_base_conhecimento_tipo ON base_conhecimento (tipo, ativo)'],
    })
    app.save(base)

    const regras = new Collection({
      name: 'regras_roteamento',
      type: 'base',
      listRule: AUTH,
      viewRule: AUTH,
      createRule: AUTH,
      updateRule: AUTH,
      deleteRule: AUTH,
      fields: [
        {
          name: 'modelo_negocio',
          type: 'relation',
          collectionId: modelos.id,
          maxSelect: 1,
          required: true,
          cascadeDelete: false,
        },
        {
          name: 'vendedor',
          type: 'relation',
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'vendedor_previsto', type: 'text', max: 120 },
        { name: 'ativo', type: 'bool' },
        { name: 'aguardando_cadastro', type: 'bool' },
        { name: 'observacao', type: 'text', max: 500 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_regras_roteamento_modelo ON regras_roteamento (modelo_negocio)',
      ],
    })
    app.save(regras)

    let julio = ''
    try {
      julio = app.findFirstRecordByFilter('users', "email = 'julio@ahmsolution.com'").id
    } catch (_) {
      julio = ''
    }
    const modeloId = (nome) => {
      try {
        return app.findFirstRecordByFilter('modelos_negocio', 'nome = {:n}', { n: nome }).id
      } catch (_) {
        return ''
      }
    }
    const semente = [
      { modelo: 'Assinatura', vendedor: julio, previsto: 'Julio' },
      { modelo: 'Cíclico', vendedor: julio, previsto: 'Julio' },
      { modelo: 'Pontual', vendedor: '', previsto: 'Paulo' },
    ]
    for (const s of semente) {
      const mid = modeloId(s.modelo)
      if (!mid) continue
      const r = new Record(regras)
      r.set('modelo_negocio', mid)
      r.set('vendedor', s.vendedor)
      r.set('vendedor_previsto', s.previsto)
      r.set('ativo', !!s.vendedor)
      r.set('aguardando_cadastro', !s.vendedor)
      r.set(
        'observacao',
        s.vendedor
          ? 'Regra definida pelo owner em 14/11/2026.'
          : 'Regra definida pelo owner em 14/11/2026 — ative quando a conta de ' +
              s.previsto +
              ' for cadastrada.',
      )
      app.save(r)
    }

    const janelas = new Collection({
      name: 'janelas_executivo',
      type: 'base',
      listRule: AUTH,
      viewRule: AUTH,
      createRule: AUTH,
      updateRule: AUTH,
      deleteRule: AUTH,
      fields: [
        {
          name: 'vendedor',
          type: 'relation',
          collectionId: users.id,
          maxSelect: 1,
          required: true,
          cascadeDelete: true,
        },
        { name: 'dia_semana', type: 'number', onlyInt: true, min: 0, max: 6, required: false },
        {
          name: 'inicio',
          type: 'text',
          required: true,
          max: 5,
          pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$',
        },
        {
          name: 'fim',
          type: 'text',
          required: true,
          max: 5,
          pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$',
        },
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_janelas_vendedor ON janelas_executivo (vendedor, dia_semana)'],
    })
    app.save(janelas)

    const envios = new Collection({
      name: 'ia_envios',
      type: 'base',
      listRule: ADMIN,
      viewRule: ADMIN,
      createRule: AUTH,
      updateRule: AUTH,
      deleteRule: AUTH,
      fields: [
        {
          name: 'lead',
          type: 'relation',
          collectionId: leads.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'oportunidade',
          type: 'relation',
          collectionId: ops.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'gatilho', type: 'text', max: 200 },
        { name: 'canal', type: 'select', maxSelect: 1, values: ['email'] },
        { name: 'destinatario', type: 'text', max: 255 },
        { name: 'assunto', type: 'text', max: 255 },
        { name: 'rascunho', type: 'text' },
        { name: 'versao_enviada', type: 'text' },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['rascunho', 'aprovado', 'enviado', 'falha', 'descartado', 'conflito'],
        },
        {
          name: 'modo',
          type: 'select',
          maxSelect: 1,
          values: ['rascunho', 'automatica', 'manual'],
        },
        {
          name: 'autorizado_por',
          type: 'relation',
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'erro', type: 'text', max: 1000 },
        { name: 'criado_em', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'atualizado_em', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_ia_envios_status ON ia_envios (status)',
        'CREATE INDEX idx_ia_envios_lead ON ia_envios (lead)',
      ],
    })
    app.save(envios)

    const config = app.findCollectionByNameOrId('configuracoes')
    if (!config.fields.getByName('valor_texto')) {
      config.fields.add(new TextField({ name: 'valor_texto', max: 255 }))
      app.save(config)
    }
    let existe = false
    try {
      app.findFirstRecordByFilter('configuracoes', "chave = 'ia_modo'")
      existe = true
    } catch (_) {
      existe = false
    }
    if (!existe) {
      const m = new Record(config)
      m.set('chave', 'ia_modo')
      m.set('valor_texto', 'rascunho')
      m.set(
        'descricao',
        'Modo de operação da IA de vendas: desligada, rascunho (nada sai sem clique humano) ou automatica.',
      )
      app.save(m)
    }
  },
  (app) => {
    try {
      app.delete(app.findFirstRecordByFilter('configuracoes', "chave = 'ia_modo'"))
    } catch (_) {}
    const config = app.findCollectionByNameOrId('configuracoes')
    config.fields.removeByName('valor_texto')
    app.save(config)
    for (const nome of [
      'ia_envios',
      'janelas_executivo',
      'regras_roteamento',
      'base_conhecimento',
    ]) {
      try {
        app.delete(app.findCollectionByNameOrId(nome))
      } catch (_) {}
    }
  },
)
