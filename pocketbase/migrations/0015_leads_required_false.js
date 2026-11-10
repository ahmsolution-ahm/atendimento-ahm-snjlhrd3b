// F1-T04 — SPEC 1.2: correção do schema de leads (required=false nos campos de RN-1.4).
// HISTÓRICO: 0.0.9 criou leads com required=true; 0.0.12 tentou recriar via 0014 mas o PocketBase
// não re-executa migrations já aplicadas — a base ativa mantém required=true.
// Esta migration NOVA (0015) altera apenas o required dos 3 campos, na base ativa e em replay.
migrate(
  (app) => {
    const leads = app.findCollectionByNameOrId('leads')
    for (const fieldName of ['nome', 'empresa', 'contato']) {
      const f = leads.fields.getByName(fieldName)
      if (f) {
        f.required = false
      }
    }
    app.save(leads)
  },
  (app) => {
    // rollback: restaura required=true (estado original da F1-T04 v0.0.9)
    const leads = app.findCollectionByNameOrId('leads')
    for (const fieldName of ['nome', 'empresa', 'contato']) {
      const f = leads.fields.getByName(fieldName)
      if (f) {
        f.required = true
      }
    }
    app.save(leads)
  },
)
