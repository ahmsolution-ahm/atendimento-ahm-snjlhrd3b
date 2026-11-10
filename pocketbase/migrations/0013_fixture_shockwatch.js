// EMENDA 1.1a — F1-T03: fixture do produto exemplo (Shockwatch completo).
// Tolerante a base vazia E a vínculos ausentes: aplica cada campo só se o lookup encontrar o registro.
// Nota: os vínculos (relation) foram aplicados também por PATCH de correção em 09/11 — esta migration
// garante o fixture em bases novas (replay completo: seeds 0009/0011 rodam antes dela).
// RN-1.2: especialista vinculado (usuário admin seed como "Especialista Produto" de demonstração).
migrate(
  (app) => {
    let produto
    try {
      produto = app.findRecordById('produtos', '3hkwgsarc7u0uuu')
    } catch (_) {
      return // base nova sem o produto exemplo — fixture não se aplica
    }
    // especialista
    try {
      const users = app.findRecordsByFilter(
        'users',
        "email = 'afonso.moreira@ahmsolution.com'",
        '',
        1,
        1,
      )
      if (users.length > 0) produto.set('especialista', users[0].id)
    } catch (_) {}
    // família tecnológica (template técnico da família impacto/tombamento)
    try {
      const templates = app.findRecordsByFilter(
        'templates_diagnostico',
        "familia = 'Impacto/tombamento descartável' && tipo = 'tecnico'",
        '',
        1,
        1,
      )
      if (templates.length > 0) produto.set('familia_tecnologica', templates[0].id)
    } catch (_) {}
    // modelo de negócio (cíclico)
    try {
      const modelos = app.findRecordsByFilter('modelos_negocio', "nome = 'Cíclico'", '', 1, 1)
      if (modelos.length > 0) produto.set('modelo_negocio', modelos[0].id)
    } catch (_) {}
    // campos de texto (sempre aplicáveis)
    produto.set('timing', 'Ciclo 45–120 dias (modelo cíclico, PUSH de recompra)')
    produto.set(
      'faq',
      'P: O indicador detecta impactos leves? R: Detecta choques acima do limite pré-definido (25–100G). | P: Precisa de bateria? R: Não — visual, sem bateria, resetável (MAG2000). | P: ROI? R: 100–300%, redução de avarias em até 30%.',
    )
    app.save(produto)
  },
  (app) => {},
)
