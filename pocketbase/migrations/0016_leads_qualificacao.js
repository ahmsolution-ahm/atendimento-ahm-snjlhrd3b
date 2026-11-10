// F1-T07 — SPEC 1.3: campos do motor de qualificação no lead.
// qualificacao_resultado: justificativa legível do último processamento (auditável).
// qualificacao_pendencias: lista do que falta para qualificar (RN-1.8).
// qualificado_em / qualificado_por: auditoria de quem e quando qualificou.
// Lição AP-2026-11-10-0600: editar coleção existente exige migration NOVA (não reescrever a 0014).
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const leads = app.findCollectionByNameOrId('leads')

    const fieldDefs = [
      { name: 'qualificacao_resultado', type: 'text' },
      { name: 'qualificacao_pendencias', type: 'json' },
      { name: 'qualificado_em', type: 'date' },
      {
        name: 'qualificado_por',
        type: 'relation',
        collectionId: users.id,
        cascadeDelete: false,
        maxSelect: 1,
      },
    ]

    for (const def of fieldDefs) {
      if (!leads.fields.getByName(def.name)) {
        leads.fields.add(new Field(def))
      }
    }
    app.save(leads)
  },
  (app) => {
    const leads = app.findCollectionByNameOrId('leads')
    for (const name of [
      'qualificacao_resultado',
      'qualificacao_pendencias',
      'qualificado_em',
      'qualificado_por',
    ]) {
      const f = leads.fields.getByName(name)
      if (f) leads.fields.removeByName(name)
    }
    app.save(leads)
  },
)
