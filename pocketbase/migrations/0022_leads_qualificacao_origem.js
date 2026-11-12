// F1-T16 — SPEC 1.6 (CA-1-016): origem da qualificação no lead, base do indicador de
// qualificação automática (RN-1.16: só entra no numerador o lead qualificado SEM
// intervenção humana).
//   qualificacao_origem (select, opcional): 'manual' | 'automatica'
//   Vazio = manual (todas as qualificações feitas até aqui foram por clique do usuário).
// O motor automático no servidor (emenda 1.3a, Fatia 1) passará a gravar 'automatica'.
// Down remove o campo.
migrate(
  (app) => {
    const leads = app.findCollectionByNameOrId('leads')
    if (!leads.fields.getByName('qualificacao_origem')) {
      leads.fields.add(
        new SelectField({
          name: 'qualificacao_origem',
          values: ['manual', 'automatica'],
          maxSelect: 1,
        }),
      )
    }
    app.save(leads)
  },
  (app) => {
    const leads = app.findCollectionByNameOrId('leads')
    leads.fields.removeByName('qualificacao_origem')
    app.save(leads)
  },
)
