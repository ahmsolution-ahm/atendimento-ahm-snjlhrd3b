// F1-T13 — SPEC 1.5: coleção oportunidades (fila de oportunidades sugeridas).
// RN-1.13: lead qualificado cria oportunidade sugerida; se já existe uma ABERTA
// (Sugerida/Em revisão) para o mesmo lead+produto, ATUALIZA a justificativa em vez
// de duplicar — idempotência garantida pelo hook (índice único não serve: status muda).
// Campos: lead (relation, obrigatório), produto (relation), justificativa (text — o
// "motivo" legível do motor de qualificação), confianca (select: alta|média|baixa,
// derivada da urgência do lead), status (Sugerida|Aprovada|Rejeitada|Em revisão),
// comentario (text, decisão humana — F1-T14), criado_em/atualizado_em (dates auditáveis).
// Regras: usuários autenticados (mesmo padrão das demais coleções da Fase 1).
migrate(
  (app) => {
    const leads = app.findCollectionByNameOrId('leads')
    const produtos = app.findCollectionByNameOrId('produtos')

    const oportunidades = new Collection({
      name: 'oportunidades',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'lead',
          type: 'relation',
          collectionId: leads.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: true,
        },
        {
          name: 'produto',
          type: 'relation',
          collectionId: produtos.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'justificativa', type: 'text', required: true },
        {
          name: 'confianca',
          type: 'select',
          values: ['alta', 'média', 'baixa'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Sugerida', 'Aprovada', 'Rejeitada', 'Em revisão'],
          maxSelect: 1,
        },
        { name: 'comentario', type: 'text' },
        { name: 'criado_em', type: 'date' },
        { name: 'atualizado_em', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_oportunidades_status ON oportunidades (status)',
        'CREATE INDEX idx_oportunidades_lead ON oportunidades (lead)',
        'CREATE INDEX idx_oportunidades_produto ON oportunidades (produto)',
      ],
    })
    app.save(oportunidades)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('oportunidades'))
    } catch (_) {}
  },
)
