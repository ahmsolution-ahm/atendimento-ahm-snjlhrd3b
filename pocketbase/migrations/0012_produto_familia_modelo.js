// EMENDA 1.1a — F1-T03: campos novos no produto.
// familia_tecnologica: relation para templates_diagnostico (RN-1.4).
// modelo_negocio: relation para modelos_negocio (substitui gradualmente o enum tipo_venda).
// adapta-divida: tipo_venda mantido para compatibilidade da tela da F1-T02; deprecação quando o formulário de produto existir.
migrate(
  (app) => {
    const produtos = app.findCollectionByNameOrId('produtos')
    const templates = app.findCollectionByNameOrId('templates_diagnostico')
    const modelos = app.findCollectionByNameOrId('modelos_negocio')

    produtos.fields.add(
      new Field({
        name: 'familia_tecnologica',
        type: 'relation',
        collectionId: templates.id,
        cascadeDelete: false,
        maxSelect: 1,
      }),
    )
    produtos.fields.add(
      new Field({
        name: 'modelo_negocio',
        type: 'relation',
        collectionId: modelos.id,
        cascadeDelete: false,
        maxSelect: 1,
      }),
    )
    app.save(produtos)
  },
  (app) => {
    const produtos = app.findCollectionByNameOrId('produtos')
    try {
      produtos.fields.removeByName('familia_tecnologica')
    } catch (_) {}
    try {
      produtos.fields.removeByName('modelo_negocio')
    } catch (_) {}
    app.save(produtos)
  },
)
