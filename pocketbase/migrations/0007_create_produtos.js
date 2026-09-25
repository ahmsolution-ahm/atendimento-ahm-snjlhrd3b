// F1-T01 — SPEC 1.1: modelo do catálogo de produtos.
// RN-1.1: nome, ICP e perguntas são obrigatórios (required em nível de schema).
// Rascunho só é permitido com incompleto = true; a regra "incompleto não fica Ativo"
// é garantida pelos hooks on_produto_create.js / on_produto_update.js.
// adapta-divida: regras de acesso iguais para todo usuário autenticado (sem papel admin/comercial no users); refinamento de permissão quando o modelo de papéis existir na fase de governança.
migrate(
  (app) => {
    const produtos = new Collection({
      name: 'produtos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'familia', type: 'text' },
        {
          name: 'tipo_venda',
          type: 'select',
          required: true,
          values: ['Recorrente', 'Pontual'],
          maxSelect: 1,
        },
        { name: 'icp', type: 'text', required: true },
        { name: 'dor', type: 'text', required: true },
        { name: 'escopo', type: 'text', required: true },
        { name: 'perguntas', type: 'text', required: true },
        { name: 'faq', type: 'text' },
        { name: 'timing', type: 'text' },
        {
          name: 'complexidade',
          type: 'select',
          required: true,
          values: ['Baixa', 'Alta'],
          maxSelect: 1,
        },
        {
          name: 'especialista',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Ativo', 'Inativo'],
          maxSelect: 1,
        },
        { name: 'incompleto', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_produtos_status ON produtos (status)',
        'CREATE INDEX idx_produtos_familia ON produtos (familia)',
        'CREATE INDEX idx_produtos_especialista ON produtos (especialista)',
      ],
    })
    app.save(produtos)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('produtos'))
    } catch (_) {}
  },
)
