// F1-T14 — SPEC 1.5 (CA-1-014): auditoria da decisão humana na oportunidade.
// Campos novos em oportunidades:
//   decidido_em  (date, opcional) — quando a última decisão foi tomada
//   decidido_por (relation → users, opcional) — quem tomou a última decisão
// Preenchidos automaticamente pelo request hook on_oportunidade_decisao.js
// (Aprovada / Rejeitada / Em revisão). Down remove os dois campos.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('oportunidades')
    const users = app.findCollectionByNameOrId('users')

    if (!col.fields.getByName('decidido_em')) {
      col.fields.add(new DateField({ name: 'decidido_em' }))
    }
    if (!col.fields.getByName('decidido_por')) {
      col.fields.add(
        new RelationField({
          name: 'decidido_por',
          collectionId: users.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('oportunidades')
    col.fields.removeByName('decidido_por')
    col.fields.removeByName('decidido_em')
    app.save(col)
  },
)
