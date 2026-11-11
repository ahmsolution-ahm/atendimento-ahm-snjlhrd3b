// F1-T10 — SPEC 1.4: coleção transbordos (fila de transbordo para especialista).
// Campos: lead (relation), produto (relation), motivo (text, obrigatório — RN-1.11),
// especialista (relation user, opcional — cenário limite: sem especialista fica pendente
// de atribuição), status (select: Pendente atribuição | Aberto | Resolvido), comentario
// (text, opcional), resolucao (text — obrigatória para fechar, RN-1.12, garantida no hook),
// resolvido_em (date), resolvido_por (relation user).
// RN-1.11/RN-1.12 vivem no hook on_transbordo_validate.js; a criação automática a partir
// da qualificação vive no hook on_leads_qualificar.js.
// Regras: usuários autenticados leem/criam/editam (mesmo padrão das demais coleções da Fase 1).
migrate(
  (app) => {
    const leads = app.findCollectionByNameOrId('leads')
    const produtos = app.findCollectionByNameOrId('produtos')
    const users = app.findCollectionByNameOrId('users')

    const transbordos = new Collection({
      name: 'transbordos',
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
        { name: 'motivo', type: 'text', required: true },
        {
          name: 'especialista',
          type: 'relation',
          collectionId: users.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Pendente atribuição', 'Aberto', 'Resolvido'],
          maxSelect: 1,
        },
        { name: 'comentario', type: 'text' },
        { name: 'resolucao', type: 'text' },
        { name: 'resolvido_em', type: 'date' },
        {
          name: 'resolvido_por',
          type: 'relation',
          collectionId: users.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_transbordos_status ON transbordos (status)',
        'CREATE INDEX idx_transbordos_lead ON transbordos (lead)',
      ],
    })
    app.save(transbordos)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('transbordos'))
    } catch (_) {}
  },
)
