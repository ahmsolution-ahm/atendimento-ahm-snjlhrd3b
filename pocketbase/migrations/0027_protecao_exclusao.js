// Fase 2 · Bloco 2 · Item 1 — proteção contra exclusão na base real (pedido do owner, 13/11).
// Regra (aplicada no hook protecao_exclusao.js): exclusão física só de registro de PROVA/DEMO.
// Registro real nunca é apagado pela API — um lead real sai de circulação por ARQUIVAMENTO.
//
// 1) Coleção exclusoes_auditoria: toda exclusão aceita (quem, o quê, quando).
//    Regras: leitura para autenticados; criação/edição/exclusão SÓ pelo servidor (null) —
//    desvio do padrão auth-only da Fase 1, justificado: auditoria não pode ser forjada/apagada.
// 2) Campos de arquivamento no lead: arquivado, arquivado_em, arquivado_por, arquivado_motivo.
// Down remove a coleção e os campos.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    const aud = new Collection({
      name: 'exclusoes_auditoria',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'colecao', type: 'text', required: true },
        { name: 'registro_id', type: 'text', required: true },
        { name: 'descricao', type: 'text' },
        { name: 'apagado_por', type: 'text' },
        {
          name: 'apagado_por_tipo',
          type: 'select',
          values: ['usuário', 'administrador'],
          maxSelect: 1,
        },
        { name: 'apagado_em', type: 'date', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      ],
      indexes: ['CREATE INDEX idx_exclusoes_auditoria_data ON exclusoes_auditoria (apagado_em)'],
    })
    app.save(aud)

    const leads = app.findCollectionByNameOrId('leads')
    if (!leads.fields.getByName('arquivado')) leads.fields.add(new BoolField({ name: 'arquivado' }))
    if (!leads.fields.getByName('arquivado_em'))
      leads.fields.add(new DateField({ name: 'arquivado_em' }))
    if (!leads.fields.getByName('arquivado_por'))
      leads.fields.add(
        new RelationField({
          name: 'arquivado_por',
          collectionId: users.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    if (!leads.fields.getByName('arquivado_motivo'))
      leads.fields.add(new TextField({ name: 'arquivado_motivo' }))
    app.save(leads)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('exclusoes_auditoria'))
    } catch (_) {}
    const leads = app.findCollectionByNameOrId('leads')
    for (const nome of ['arquivado', 'arquivado_em', 'arquivado_por', 'arquivado_motivo']) {
      leads.fields.removeByName(nome)
    }
    app.save(leads)
  },
)
