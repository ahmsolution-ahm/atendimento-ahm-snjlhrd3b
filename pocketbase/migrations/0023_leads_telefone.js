// Bloco 4 — pendência técnica da Fase 1: campo telefone no lead.
//   telefone (text, opcional) — antes ia misturado em "observacoes".
// A importação CSV mapeia as colunas Telefone/Celular/Phone para este campo; a tela Leads
// permite informar no Novo Lead e editar no Editar Lead; o modal da oportunidade exibe.
// Down remove o campo.
migrate(
  (app) => {
    const leads = app.findCollectionByNameOrId('leads')
    if (!leads.fields.getByName('telefone')) {
      leads.fields.add(new TextField({ name: 'telefone' }))
    }
    app.save(leads)
  },
  (app) => {
    const leads = app.findCollectionByNameOrId('leads')
    leads.fields.removeByName('telefone')
    app.save(leads)
  },
)
