// F1-T04 — SPEC 1.2: modelo de leads (cadastro manual).
// Campos: nome, empresa, contato (obrigatórios — RN-1.4, garantidos pelo hook on_leads_validate.js,
// não pelo schema: rascunho com incompleto=true é permitido pela SPEC); origem, produto_interesse
// (relation), dor, urgencia, observacoes, responsavel (relation opcional), status (fila), incompleto.
// RN-1.6: lead sem produto de interesse = pendente (hook on_leads_produto_pendente.js).
// adapta-divida: index de duplicidade (contato+empresa) entra na F1-T06.
// NOTA v0.0.11: a coleção já existe na base ativa (criada em 0.0.9 com required=true) — esta migration
// agora ATUALIZA o schema em vez de criar (upsert), para corrigir required=false em replay e na base ativa.
migrate(
  (app) => {
    const produtos = app.findCollectionByNameOrId('produtos')
    let leads
    try {
      leads = app.findCollectionByNameOrId('leads')
    } catch (_) {
      leads = new Collection({
        name: 'leads',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [],
      })
    }

    const fieldDefs = [
      { name: 'nome', type: 'text', required: false },
      { name: 'empresa', type: 'text', required: false },
      { name: 'contato', type: 'text', required: false },
      { name: 'origem', type: 'text' },
      {
        name: 'produto_interesse',
        type: 'relation',
        collectionId: produtos.id,
        cascadeDelete: false,
        maxSelect: 1,
      },
      { name: 'dor', type: 'text' },
      {
        name: 'urgencia',
        type: 'select',
        values: ['Baixa', 'Média', 'Alta'],
        maxSelect: 1,
      },
      { name: 'observacoes', type: 'text' },
      {
        name: 'responsavel',
        type: 'relation',
        collectionId: '_pb_users_auth_',
        cascadeDelete: false,
        maxSelect: 1,
      },
      {
        name: 'status',
        type: 'select',
        required: true,
        values: [
          'novo',
          'em qualificação',
          'qualificado',
          'pendente',
          'fora do recorte',
          'transbordo',
        ],
        maxSelect: 1,
      },
      { name: 'incompleto', type: 'bool' },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ]

    for (const def of fieldDefs) {
      const existing = leads.fields.getByName(def.name)
      if (existing) {
        if (existing.type === 'select' && def.values) existing.values = def.values
        if ('required' in def) existing.required = def.required
      } else {
        leads.fields.add(new Field(def))
      }
    }

    const indexDefs = [
      'CREATE INDEX idx_leads_status ON leads (status)',
      'CREATE INDEX idx_leads_empresa ON leads (empresa)',
      'CREATE INDEX idx_leads_produto ON leads (produto_interesse)',
    ]
    leads.indexes = indexDefs

    app.save(leads)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('leads'))
    } catch (_) {}
  },
)
