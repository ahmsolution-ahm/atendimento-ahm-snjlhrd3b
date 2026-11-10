// EMENDA 1.1a — F1-T03: coleção de templates de diagnóstico por FAMÍLIA tecnológica.
// 8 famílias mapeadas a partir de 14 documentos-fonte (emenda-1.1a, seção 3).
// perguntas_json: array estruturado [{id, bloco, tipo, texto, opcoes?, escala?}]
migrate(
  (app) => {
    const templates = new Collection({
      name: 'templates_diagnostico',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'familia', type: 'text', required: true },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: [
            'tecnico',
            'cenario',
            'auditoria',
            'checklist_triagem',
            'qualificacao_consultiva',
          ],
          maxSelect: 1,
        },
        { name: 'titulo', type: 'text', required: true },
        { name: 'produtos_cobertos', type: 'text', required: true },
        { name: 'perguntas_json', type: 'json', required: true },
        { name: 'blocos_comuns', type: 'text' },
        { name: 'fonte', type: 'text', required: true },
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_templates_familia ON templates_diagnostico (familia)'],
    })
    app.save(templates)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('templates_diagnostico'))
    } catch (_) {}
  },
)
