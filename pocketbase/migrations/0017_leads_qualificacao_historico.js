// F1-T08 — SPEC 1.3: histórico de qualificação (reprocessamento auditável).
// qualificacao_historico: json — lista de processamentos anteriores {em, por, status, resultado}.
// Cada nova qualificação anexa a anterior (nunca sobrescreve); cap de 20 entradas no hook.
// Lição AP-2026-11-10-0600: editar coleção existente exige migration NOVA.
migrate(
  (app) => {
    const leads = app.findCollectionByNameOrId('leads')
    if (!leads.fields.getByName('qualificacao_historico')) {
      leads.fields.add(new Field({ name: 'qualificacao_historico', type: 'json' }))
    }
    app.save(leads)
  },
  (app) => {
    const leads = app.findCollectionByNameOrId('leads')
    const f = leads.fields.getByName('qualificacao_historico')
    if (f) leads.fields.removeByName('qualificacao_historico')
    app.save(leads)
  },
)
