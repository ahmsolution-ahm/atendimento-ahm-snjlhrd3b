// F1-T19/T20/T21 — SPEC 1.7 (CA-1-019..021): timeline de interações do lead até a proposta.
// Campos: lead (relation, obrigatório), tipo (select), data (date, obrigatório — quando a
// interação ocorreu), responsavel (relation users), observacao (text), proposta (bool —
// marca a interação que fechou a proposta; única por lead entre as não canceladas),
// cancelada (bool) + cancelada_em/cancelada_motivo/cancelada_por (cancelamento auditável —
// o registro NUNCA é apagado), criado_em (date).
// Validações e auditoria vivem no hook on_interacoes_validate.js.
// Regras: usuários autenticados (mesmo padrão das demais coleções da Fase 1).
migrate(
  (app) => {
    const leads = app.findCollectionByNameOrId('leads')
    const users = app.findCollectionByNameOrId('users')

    const interacoes = new Collection({
      name: 'interacoes',
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
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['Ligação', 'Reunião', 'E-mail', 'WhatsApp', 'Visita', 'Outro'],
          maxSelect: 1,
        },
        { name: 'data', type: 'date', required: true },
        {
          name: 'responsavel',
          type: 'relation',
          collectionId: users.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'observacao', type: 'text' },
        { name: 'proposta', type: 'bool' },
        { name: 'cancelada', type: 'bool' },
        { name: 'cancelada_em', type: 'date' },
        { name: 'cancelada_motivo', type: 'text' },
        {
          name: 'cancelada_por',
          type: 'relation',
          collectionId: users.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'criado_em', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_interacoes_lead_data ON interacoes (lead, data)'],
    })
    app.save(interacoes)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('interacoes'))
    } catch (_) {}
  },
)
