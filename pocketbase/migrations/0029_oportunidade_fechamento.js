// Fase 2 · Bloco 2 · Item 3 (F2-T06) — fechamento ganho/perda com motivo auditável.
// Campos em oportunidades: resultado (ganha|perdida; vazio = em andamento), resultado_motivo,
// concorrente, fechado_em, fechado_por, reabertura_motivo (justificativa ao reabrir),
// resultado_por (quem fez a última ação de fechamento/reabertura — gravado no hook).
// Coleção oportunidade_fechamentos: registro imutável de cada fechamento e reabertura
// (nada é apagado — padrão das interações). Regras: leitura para autenticados; escrita SÓ
// pelo servidor (null) — desvio justificado: o histórico não pode ser forjado nem apagado.
// Down remove a coleção e os campos.
migrate(
  (app) => {
    const ops = app.findCollectionByNameOrId('oportunidades')
    const users = app.findCollectionByNameOrId('users')

    const add = (f) => {
      if (!ops.fields.getByName(f.name)) ops.fields.add(f)
    }
    add(new SelectField({ name: 'resultado', values: ['ganha', 'perdida'], maxSelect: 1 }))
    add(new TextField({ name: 'resultado_motivo' }))
    add(new TextField({ name: 'concorrente' }))
    add(new DateField({ name: 'fechado_em' }))
    add(
      new RelationField({
        name: 'fechado_por',
        collectionId: users.id,
        cascadeDelete: false,
        maxSelect: 1,
      }),
    )
    add(new TextField({ name: 'reabertura_motivo' }))
    add(
      new RelationField({
        name: 'resultado_por',
        collectionId: users.id,
        cascadeDelete: false,
        maxSelect: 1,
      }),
    )
    app.save(ops)

    const log = new Collection({
      name: 'oportunidade_fechamentos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: null,
      updateRule: null,
      deleteRule: null,
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
          name: 'acao',
          type: 'select',
          required: true,
          values: ['fechamento', 'reabertura'],
          maxSelect: 1,
        },
        { name: 'resultado', type: 'select', values: ['ganha', 'perdida'], maxSelect: 1 },
        { name: 'motivo', type: 'text', required: true },
        { name: 'concorrente', type: 'text' },
        { name: 'valor_estimado', type: 'number' },
        { name: 'moeda', type: 'text' },
        {
          name: 'registrado_por',
          type: 'relation',
          collectionId: users.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'registrado_em', type: 'date', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      ],
      indexes: [
        'CREATE INDEX idx_fechamentos_op ON oportunidade_fechamentos (oportunidade, registrado_em)',
      ],
    })
    app.save(log)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('oportunidade_fechamentos'))
    } catch (_) {}
    const ops = app.findCollectionByNameOrId('oportunidades')
    for (const nome of [
      'resultado',
      'resultado_motivo',
      'concorrente',
      'fechado_em',
      'fechado_por',
      'reabertura_motivo',
      'resultado_por',
    ]) {
      ops.fields.removeByName(nome)
    }
    app.save(ops)
  },
)
