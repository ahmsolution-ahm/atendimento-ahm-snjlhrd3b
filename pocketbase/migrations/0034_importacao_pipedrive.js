// Fase 2 · Bloco D — importação do histórico do Pipedrive (decisões do owner em
// 06_notas/analise-bloco-d-pipedrive.md, aprovadas em 14/11/2026).
// Campos de ORIGEM (rastreabilidade e importação repetível sem duplicar):
//   oportunidades: pipedrive_id (único quando preenchido), pipedrive_proprietario,
//                  pipedrive_produto, valor_original, moeda_original
//                  (a data de criação original vai no campo existente criado_em)
//   leads:         pipedrive_id (único quando preenchido — negócios do funil de Pré-vendas),
//                  pipedrive_criado_em, pipedrive_etapa (funil > etapa > status no Pipedrive)
// Down: remove índices e campos.
migrate(
  (app) => {
    const ops = app.findCollectionByNameOrId('oportunidades')
    const addOp = (f) => {
      if (!ops.fields.getByName(f.name)) ops.fields.add(f)
    }
    addOp(new TextField({ name: 'pipedrive_id', max: 40 }))
    addOp(new TextField({ name: 'pipedrive_proprietario', max: 120 }))
    addOp(new TextField({ name: 'pipedrive_produto', max: 255 }))
    addOp(new NumberField({ name: 'valor_original' }))
    addOp(new TextField({ name: 'moeda_original', max: 10 }))
    ops.addIndex('idx_oportunidades_pipedrive', true, 'pipedrive_id', "pipedrive_id != ''")
    app.save(ops)

    const leads = app.findCollectionByNameOrId('leads')
    const addLead = (f) => {
      if (!leads.fields.getByName(f.name)) leads.fields.add(f)
    }
    addLead(new TextField({ name: 'pipedrive_id', max: 40 }))
    addLead(new DateField({ name: 'pipedrive_criado_em' }))
    addLead(new TextField({ name: 'pipedrive_etapa', max: 255 }))
    leads.addIndex('idx_leads_pipedrive', true, 'pipedrive_id', "pipedrive_id != ''")
    app.save(leads)
  },
  (app) => {
    const ops = app.findCollectionByNameOrId('oportunidades')
    ops.removeIndex('idx_oportunidades_pipedrive')
    for (const n of [
      'pipedrive_id',
      'pipedrive_proprietario',
      'pipedrive_produto',
      'valor_original',
      'moeda_original',
    ]) {
      ops.fields.removeByName(n)
    }
    app.save(ops)
    const leads = app.findCollectionByNameOrId('leads')
    leads.removeIndex('idx_leads_pipedrive')
    for (const n of ['pipedrive_id', 'pipedrive_criado_em', 'pipedrive_etapa']) {
      leads.fields.removeByName(n)
    }
    app.save(leads)
  },
)
