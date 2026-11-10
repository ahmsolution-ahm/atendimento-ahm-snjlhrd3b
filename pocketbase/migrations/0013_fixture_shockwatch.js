// EMENDA 1.1a — F1-T03: fixture do produto exemplo (Shockwatch completo).
// Idempotente: atualiza o Shockwatch existente (id 3hkwgsarc7u0uuu) com especialista, timing, FAQ,
// família tecnológica (template impacto/tombamento) e modelo de negócio (cíclico).
// RN-1.2: especialista vinculado (usuário admin seed como "Especialista Produto" de demonstração).
migrate(
  (app) => {
    const produto = app.findRecordById('produtos', '3hkwgsarc7u0uuu')
    const templates = app.findRecordsByFilter(
      'templates_diagnostico',
      "familia = 'Impacto/tombamento descartável' && tipo = 'tecnico'",
      '',
      1,
      1,
    )
    const modelos = app.findRecordsByFilter('modelos_negocio', "nome = 'Cíclico'", '', 1, 1)
    const users = app.findRecordsByFilter(
      'users',
      "email = 'afonso.moreira@ahmsolution.com'",
      '',
      1,
      1,
    )

    produto.set('especialista', users.length > 0 ? users[0].id : '')
    produto.set('timing', 'Ciclo 45–120 dias (modelo cíclico, PUSH de recompra)')
    produto.set(
      'faq',
      'P: O indicador detecta impactos leves? R: Detecta choques acima do limite pré-definido (25–100G). | P: Precisa de bateria? R: Não — visual, sem bateria, resetável (MAG2000). | P: ROI? R: 100–300%, redução de avarias em até 30%.',
    )
    if (templates.length > 0) produto.set('familia_tecnologica', templates[0].id)
    if (modelos.length > 0) produto.set('modelo_negocio', modelos[0].id)
    app.save(produto)
  },
  (app) => {},
)
