migrate(
  (app) => {
    // Garantir usuário inicial afonso.moreira@ahmsolution.com
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    try {
      app.findAuthRecordByEmail('_pb_users_auth_', 'afonso.moreira@ahmsolution.com')
    } catch (_) {
      const record = new Record(users)
      record.setEmail('afonso.moreira@ahmsolution.com')
      record.setPassword('Skip@Pass')
      record.setVerified(true)
      record.set('name', 'Afonso Moreira')
      app.save(record)
    }

    // Coleção tickets
    const tickets = new Collection({
      name: 'tickets',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'ticket_id', type: 'text', required: true },
        { name: 'assunto', type: 'text', required: true },
        { name: 'cliente', type: 'text', required: true },
        { name: 'descricao', type: 'text' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Aberto', 'Em andamento', 'Resolvido', 'Fechado'],
          maxSelect: 1,
        },
        {
          name: 'prioridade',
          type: 'select',
          required: true,
          values: ['Baixa', 'Média', 'Alta', 'Urgente'],
          maxSelect: 1,
        },
        {
          name: 'canal',
          type: 'select',
          required: true,
          values: ['Email', 'Telefone', 'WhatsApp', 'Chat'],
          maxSelect: 1,
        },
        {
          name: 'responsavel',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'created_by',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_tickets_ticket_id ON tickets (ticket_id)',
        'CREATE INDEX idx_tickets_status ON tickets (status)',
        'CREATE INDEX idx_tickets_prioridade ON tickets (prioridade)',
        'CREATE INDEX idx_tickets_created ON tickets (created)',
        'CREATE INDEX idx_tickets_responsavel ON tickets (responsavel)',
      ],
    })
    app.save(tickets)
  },
  (app) => {
    try {
      const tickets = app.findCollectionByNameOrId('tickets')
      app.delete(tickets)
    } catch (_) {}
  },
)
