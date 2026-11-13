// F2-T03 — emenda 1.2b (ratificada 12/11): etapas do pipeline em DUAS TRILHAS pela
// complexidade do produto (fonte canônica: emenda 1.1a §4).
//   trilha baixa (AHM Cycle, 5 fases)       — produtos de complexidade Baixa
//   trilha alta (Site Assessment, 8 etapas) — produtos de complexidade Alta
// Campos: trilha, ordem, nome, fase (Pré-venda | Venda | Pós-venda), taxa_alvo (%), complexidade.
// Seed das 13 etapas. Regras: usuários autenticados (padrão da Fase 1).
// Down apaga a coleção (e as etapas).
migrate(
  (app) => {
    const col = new Collection({
      name: 'pipeline_etapas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'trilha', type: 'select', required: true, values: ['baixa', 'alta'], maxSelect: 1 },
        { name: 'ordem', type: 'number', required: true, onlyInt: true, min: 1 },
        { name: 'nome', type: 'text', required: true },
        {
          name: 'fase',
          type: 'select',
          required: true,
          values: ['Pré-venda', 'Venda', 'Pós-venda'],
          maxSelect: 1,
        },
        { name: 'taxa_alvo', type: 'number', min: 0, max: 100 },
        { name: 'complexidade', type: 'select', values: ['Baixa', 'Alta'], maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_pipeline_etapas_trilha_ordem ON pipeline_etapas (trilha, ordem)',
      ],
    })
    app.save(col)

    const etapas = [
      // trilha baixa — AHM Cycle (5 fases)
      ['baixa', 1, 'Problema Emergente', 'Pré-venda', 60],
      ['baixa', 2, 'Diagnóstico Técnico Compartilhado', 'Venda', 70],
      ['baixa', 3, 'Proposta Customizada', 'Venda', 90],
      ['baixa', 4, 'Implementação Piloto', 'Pós-venda', 100],
      ['baixa', 5, 'Acompanhamento e Expansão', 'Pós-venda', 100],
      // trilha alta — Site Assessment (8 etapas)
      ['alta', 1, 'Cenário Atual', 'Pré-venda', 60],
      ['alta', 2, 'Diagnóstico', 'Pré-venda', 70],
      ['alta', 3, 'Refinamento (visita técnica)', 'Pré-venda', 80],
      ['alta', 4, 'Apresentação de Projeto', 'Venda', 90],
      ['alta', 5, 'Negociação (prova de conceito)', 'Venda', 95],
      ['alta', 6, 'Implementação', 'Pós-venda', 100],
      ['alta', 7, 'Realidade', 'Pós-venda', 100],
      ['alta', 8, 'Adoção Corporativa', 'Pós-venda', 100],
    ]
    for (const [trilha, ordem, nome, fase, taxa] of etapas) {
      const r = new Record(col)
      r.set('trilha', trilha)
      r.set('ordem', ordem)
      r.set('nome', nome)
      r.set('fase', fase)
      r.set('taxa_alvo', taxa)
      r.set('complexidade', trilha === 'baixa' ? 'Baixa' : 'Alta')
      app.save(r)
    }
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('pipeline_etapas'))
    } catch (_) {}
  },
)
