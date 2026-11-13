// Fase 2 · Bloco 2 · Item 2 (F2-T05, RN-2.4) — checklist de conclusão por etapa.
// - pipeline_etapas ganha responsavel_sugerido e duracao (emenda 1.1a §4 — Site Assessment).
// - etapa_checklist_itens: itens por etapa — tipo criterio (fator de sucesso / critério de
//   conclusão), insucesso (sinal que gera alerta) ou pergunta (pergunta de reflexão).
//   Coleção própria (não JSON na etapa): cada item tem id estável, então a resposta aponta
//   para ele e a auditoria sobrevive a edições do texto; o hook JS também não grava JSON.
// - etapa_checklist_respostas: marcação de cada item na passagem da etapa, ligada ao registro
//   de histórico (oportunidade_etapas) — quem respondeu e quando (gravado no hook).
// Seed: SÓ o conteúdo documentado no repositório — responsável/duração das 8 etapas do Site
// Assessment (emenda 1.1a §4) e os sinais de insucesso da etapa 6 (briefing do Bloco 2).
// Os demais itens (Manual de Vendas 05 / Playbook) entram em migration própria quando o owner
// reenviar o material — nada da metodologia é inventado aqui.
// Down remove as coleções e os campos.
migrate(
  (app) => {
    const etapas = app.findCollectionByNameOrId('pipeline_etapas')
    const hist = app.findCollectionByNameOrId('oportunidade_etapas')
    const users = app.findCollectionByNameOrId('users')

    if (!etapas.fields.getByName('responsavel_sugerido'))
      etapas.fields.add(new TextField({ name: 'responsavel_sugerido' }))
    if (!etapas.fields.getByName('duracao')) etapas.fields.add(new TextField({ name: 'duracao' }))
    app.save(etapas)

    const regras = {
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
    }

    const itens = new Collection({
      name: 'etapa_checklist_itens',
      type: 'base',
      ...regras,
      fields: [
        {
          name: 'etapa',
          type: 'relation',
          collectionId: etapas.id,
          cascadeDelete: true,
          maxSelect: 1,
          required: true,
        },
        { name: 'ordem', type: 'number', onlyInt: true },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['criterio', 'insucesso', 'pergunta'],
          maxSelect: 1,
        },
        { name: 'texto', type: 'text', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_checklist_itens_etapa ON etapa_checklist_itens (etapa, ordem)'],
    })
    app.save(itens)

    const respostas = new Collection({
      name: 'etapa_checklist_respostas',
      type: 'base',
      ...regras,
      fields: [
        {
          name: 'historico',
          type: 'relation',
          collectionId: hist.id,
          cascadeDelete: true,
          maxSelect: 1,
          required: true,
        },
        {
          name: 'item',
          type: 'relation',
          collectionId: itens.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: true,
        },
        { name: 'marcado', type: 'bool' },
        { name: 'observacao', type: 'text' },
        {
          name: 'respondido_por',
          type: 'relation',
          collectionId: users.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'respondido_em', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      ],
      indexes: [
        'CREATE INDEX idx_checklist_respostas_hist ON etapa_checklist_respostas (historico)',
      ],
    })
    app.save(respostas)

    // responsável sugerido e duração — Site Assessment (emenda 1.1a §4)
    const sa = [
      [1, 'Analista Comercial Jr.', '1 a 3 dias'],
      [2, 'Analista Comercial Pleno/Sênior + Especialista de Categoria', '1 a 3 dias'],
      [3, 'Analista Comercial Pleno/Sênior', '1 a 15 dias'],
      [4, 'KAM / Coordenador', '1 a 15 dias'],
      [5, 'KAM / Coordenador', '1 a 20 dias'],
      [6, 'Equipe Técnica / Engenheiros', '1 a 30 dias'],
      [7, 'Qualidade e Relacionamento', '1 a 30 dias'],
      [8, 'Consultor + Marketing', '1 a 30 dias'],
    ]
    for (const [ordem, resp, dur] of sa) {
      try {
        const e = app.findFirstRecordByFilter(
          'pipeline_etapas',
          'trilha = "alta" && ordem = {:o}',
          {
            o: ordem,
          },
        )
        e.set('responsavel_sugerido', resp)
        e.set('duracao', dur)
        app.save(e)
      } catch (_) {}
    }

    // sinais de insucesso da etapa 6 (Implementação) — exemplo documentado no briefing
    try {
      const e6 = app.findFirstRecordByFilter('pipeline_etapas', 'trilha = "alta" && ordem = 6')
      const sinais = [
        'Cliente sem instruções de uso da solução',
        'Cliente não sabe qual é a meta da implementação',
        'Sem alinhamento com as demais equipes do cliente',
        'A implementação não gera um entregável',
      ]
      sinais.forEach((texto, i) => {
        const r = new Record(itens)
        r.set('etapa', e6.id)
        r.set('ordem', i + 1)
        r.set('tipo', 'insucesso')
        r.set('texto', texto)
        app.save(r)
      })
    } catch (_) {}
  },
  (app) => {
    for (const nome of ['etapa_checklist_respostas', 'etapa_checklist_itens']) {
      try {
        app.delete(app.findCollectionByNameOrId(nome))
      } catch (_) {}
    }
    const etapas = app.findCollectionByNameOrId('pipeline_etapas')
    etapas.fields.removeByName('responsavel_sugerido')
    etapas.fields.removeByName('duracao')
    app.save(etapas)
  },
)
