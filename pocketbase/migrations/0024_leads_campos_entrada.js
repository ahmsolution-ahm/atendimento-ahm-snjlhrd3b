// F2-T01 — emenda 1.2a §3 (ratificada 12/11): campos de entrada no lead.
//   area_interesse (select): Qualidade no Transporte | Cadeia do Frio | Segurança e Logística
//   pais (text)            : default "Brasil" aplicado na tela/importação para leads novos
//   idioma (select)        : pt-BR | es | en (default pt-BR na tela/importação)
//   modelo_compra (select) : Nacional | Importação
// Todos opcionais: os 15.370 leads existentes ficam com os campos vazios (nada é reescrito).
// Down remove os quatro campos.
migrate(
  (app) => {
    const leads = app.findCollectionByNameOrId('leads')
    if (!leads.fields.getByName('area_interesse')) {
      leads.fields.add(
        new SelectField({
          name: 'area_interesse',
          values: ['Qualidade no Transporte', 'Cadeia do Frio', 'Segurança e Logística'],
          maxSelect: 1,
        }),
      )
    }
    if (!leads.fields.getByName('pais')) {
      leads.fields.add(new TextField({ name: 'pais' }))
    }
    if (!leads.fields.getByName('idioma')) {
      leads.fields.add(
        new SelectField({ name: 'idioma', values: ['pt-BR', 'es', 'en'], maxSelect: 1 }),
      )
    }
    if (!leads.fields.getByName('modelo_compra')) {
      leads.fields.add(
        new SelectField({
          name: 'modelo_compra',
          values: ['Nacional', 'Importação'],
          maxSelect: 1,
        }),
      )
    }
    app.save(leads)
  },
  (app) => {
    const leads = app.findCollectionByNameOrId('leads')
    for (const nome of ['area_interesse', 'pais', 'idioma', 'modelo_compra']) {
      leads.fields.removeByName(nome)
    }
    app.save(leads)
  },
)
