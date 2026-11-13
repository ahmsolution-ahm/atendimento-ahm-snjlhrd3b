// F2-T02/T03/T04 — emendas 1.2a §3 e 1.2b (ratificadas 12/11).
// Campos novos em oportunidades:
//   ambiente_fechamento (select): Venda em reais | Locação em reais | Exportação (EUA)
//   moeda (select BRL|USD) e entidade_vendedora (select) — DERIVADOS do ambiente pelo hook
//   valor_estimado (number) — obrigatório para avançar de etapa (decisão do owner)
//   trilha (select baixa|alta) — derivada da complexidade do produto (RN-2.1), nunca manual
//   etapa_atual (relation pipeline_etapas) + etapa_desde (date) — RN-2.2
//   etapa_por (relation users) — quem fez a última troca (gravado no hook de requisição)
// Coleção nova oportunidade_etapas (histórico de passagem — RN-2.2):
//   oportunidade (relation, cascata ao apagar a oportunidade), etapa (relation),
//   entrou_em (date), saiu_em (date), responsavel (relation users).
// Down remove a coleção de histórico e os campos novos.
migrate(
  (app) => {
    const ops = app.findCollectionByNameOrId('oportunidades')
    const etapas = app.findCollectionByNameOrId('pipeline_etapas')
    const users = app.findCollectionByNameOrId('users')

    const add = (field) => {
      if (!ops.fields.getByName(field.name)) ops.fields.add(field)
    }
    add(
      new SelectField({
        name: 'ambiente_fechamento',
        values: ['Venda em reais', 'Locação em reais', 'Exportação (EUA)'],
        maxSelect: 1,
      }),
    )
    add(new SelectField({ name: 'moeda', values: ['BRL', 'USD'], maxSelect: 1 }))
    add(
      new SelectField({
        name: 'entidade_vendedora',
        values: ['AHM Brasil', 'AHM Solution Americas'],
        maxSelect: 1,
      }),
    )
    add(new NumberField({ name: 'valor_estimado', min: 0 }))
    add(new SelectField({ name: 'trilha', values: ['baixa', 'alta'], maxSelect: 1 }))
    add(
      new RelationField({
        name: 'etapa_atual',
        collectionId: etapas.id,
        cascadeDelete: false,
        maxSelect: 1,
      }),
    )
    add(new DateField({ name: 'etapa_desde' }))
    add(
      new RelationField({
        name: 'etapa_por',
        collectionId: users.id,
        cascadeDelete: false,
        maxSelect: 1,
      }),
    )
    app.save(ops)

    const hist = new Collection({
      name: 'oportunidade_etapas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'oportunidade',
          type: 'relation',
          collectionId: ops.id,
          cascadeDelete: true,
          maxSelect: 1,
          required: true,
        },
        {
          name: 'etapa',
          type: 'relation',
          collectionId: etapas.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: true,
        },
        { name: 'entrou_em', type: 'date', required: true },
        { name: 'saiu_em', type: 'date' },
        {
          name: 'responsavel',
          type: 'relation',
          collectionId: users.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_oportunidade_etapas_op ON oportunidade_etapas (oportunidade, entrou_em)',
      ],
    })
    app.save(hist)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('oportunidade_etapas'))
    } catch (_) {}
    const ops = app.findCollectionByNameOrId('oportunidades')
    for (const nome of [
      'ambiente_fechamento',
      'moeda',
      'entidade_vendedora',
      'valor_estimado',
      'trilha',
      'etapa_atual',
      'etapa_desde',
      'etapa_por',
    ]) {
      ops.fields.removeByName(nome)
    }
    app.save(ops)
  },
)
