// EMENDA 1.1a — F1-T03: seed dos 5 modelos de negócio ratificados pelo owner (09/11/2026).
// Assinatura, Locação, Cíclico, Pontual, Consultoria de Serviços.
// Idempotente: só insere se a coleção estiver vazia.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('modelos_negocio')
    const existing = app.countRecords(col)
    if (existing > 0) return
    const modelos = [
      {
        nome: 'Assinatura',
        descricao:
          'Venda contínua via planos/mensalidades — facilidade na contratação, sem burocracia; atrai o cliente 1x e revende.',
        ciclo_dias_min: 30,
        ciclo_dias_max: 60,
        condicoes_pagamento: 'Faturado 15 dd (boleto ou depósito)',
        canal: 'Direto/digital',
        fornecedores: '',
        previsibilidade: true,
        complexidade_tipica: 'Baixa',
      },
      {
        nome: 'Locação',
        descricao:
          'Mesmas condições da assinatura, com pagamento em 30 dias. Cliente que prefere não imobilizar capital.',
        ciclo_dias_min: 30,
        ciclo_dias_max: 60,
        condicoes_pagamento: 'Pagamento em 30 dias',
        canal: 'Direto/digital',
        fornecedores: '',
        previsibilidade: true,
        complexidade_tipica: 'Baixa',
      },
      {
        nome: 'Cíclico',
        descricao:
          'Produtos de uso contínuo com estratégia PUSH de recompra (histórico + relacionamento com carteira). AHM Cycle.',
        ciclo_dias_min: 45,
        ciclo_dias_max: 120,
        condicoes_pagamento: 'Faturado 21 dd (negociável quando necessário)',
        canal: 'Direto/digital',
        fornecedores: 'SpotSee',
        previsibilidade: true,
        complexidade_tipica: 'Baixa',
      },
      {
        nome: 'Pontual',
        descricao:
          'Projetos personalizados, soluções duradouras, recompra eventual. Não garante previsibilidade de faturamento.',
        ciclo_dias_min: 150,
        ciclo_dias_max: 210,
        condicoes_pagamento: '100% antecipado OU 50% OC + 50% faturamento OU faturado 21 dd',
        canal: 'Direto/digital',
        fornecedores:
          'Meijer Handling Solution, Seen Safety, Frederick Energy Products, Proxicam, Orlaco',
        previsibilidade: false,
        complexidade_tipica: 'Alta',
      },
      {
        nome: 'Consultoria de Serviços',
        descricao:
          'Consultoria em processos da cadeia logística e intralogística com metodologia própria de diagnóstico, apontamentos e recomendações técnicas (ex.: plano de tráfego/Risk Assessment ISO).',
        ciclo_dias_min: 60,
        ciclo_dias_max: 90,
        condicoes_pagamento: 'Faturado 30 dd (boleto)',
        canal: 'Direto/digital',
        fornecedores: 'A própria AHM',
        previsibilidade: false,
        complexidade_tipica: 'Alta',
      },
    ]
    for (const m of modelos) {
      const r = new Record(col)
      r.set('nome', m.nome)
      r.set('descricao', m.descricao)
      r.set('ciclo_dias_min', m.ciclo_dias_min)
      r.set('ciclo_dias_max', m.ciclo_dias_max)
      r.set('condicoes_pagamento', m.condicoes_pagamento)
      r.set('canal', m.canal)
      r.set('fornecedores', m.fornecedores)
      r.set('previsibilidade', m.previsibilidade)
      r.set('complexidade_tipica', m.complexidade_tipica)
      app.save(r)
    }
  },
  (app) => {},
)
