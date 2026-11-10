// EMENDA 1.1a — F1-T03: coleção de modelos de negócio (referência comercial da AHM).
// Definições ratificadas pelo owner em 2026-11-09 (emenda-1.1a, seção 1).
// Bíblia de Vendas desatualizada — vigente: cíclico 45-120d/21dd/PUSH; pontual = projetos personalizados.
migrate(
  (app) => {
    const modelos = new Collection({
      name: 'modelos_negocio',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'descricao', type: 'text', required: true },
        { name: 'ciclo_dias_min', type: 'number', required: true },
        { name: 'ciclo_dias_max', type: 'number', required: true },
        { name: 'condicoes_pagamento', type: 'text', required: true },
        { name: 'canal', type: 'text', required: true },
        { name: 'fornecedores', type: 'text' },
        { name: 'previsibilidade', type: 'bool' },
        {
          name: 'complexidade_tipica',
          type: 'select',
          required: true,
          values: ['Baixa', 'Alta'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_modelos_nome ON modelos_negocio (nome)'],
    })
    app.save(modelos)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('modelos_negocio'))
    } catch (_) {}
  },
)
