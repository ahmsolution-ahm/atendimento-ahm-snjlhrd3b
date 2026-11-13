// Fase 2 · Bloco 2 · Item 2 (F2-T05) — seed do conteúdo do checklist das 13 etapas.
// Fonte: 06_notas/conteudo-checklist-etapas-f2-t05.md (Bart, 13/11/2026) — Manual de Vendas 05
// (consolidação aprovada pelo owner em 09/11/2026) para a trilha alta e Playbook de Vendas Baixa
// Complexidade (abr/2026) para a trilha baixa.
// Os 4 insucessos da etapa 6 (alta) já vieram da 0028 e NÃO são repetidos aqui; a etapa 6 só
// ganha os critérios, com ordem a partir de 5.
// Idempotente: item com a mesma etapa e o mesmo texto não é recriado.
// Down: remove só os itens desta lista (por etapa + texto); item que já tem resposta registrada
// fica (a resposta aponta para ele e a auditoria não pode perder a referência).
migrate(
  (app) => {
    const itens = app.findCollectionByNameOrId('etapa_checklist_itens')
    const C = 'criterio'
    const I = 'insucesso'
    const P = 'pergunta'

    // [trilha, ordem da etapa, ordem inicial, [[tipo, texto], ...]]
    const conteudo = [
      [
        'alta',
        1,
        1,
        [
          [C, 'Indicação positiva do Cliente Ideal confirmada'],
          [C, 'Contatos confirmados e registrados no CRM'],
          [P, 'A prospecção foi direta ou apoiada em relatórios de inteligência do negócio?'],
        ],
      ],
      [
        'alta',
        2,
        1,
        [
          [C, 'Cargo, área e papel do contato identificados'],
          [C, 'Problema claro identificado'],
          [C, 'Visita técnica agendada'],
          [C, 'Tudo registrado no CRM'],
          [P, 'Qual é a dor do cliente? Onde dói?'],
          [P, 'O cliente consegue visualizar a solução ideal?'],
          [P, 'Existe algum impedimento técnico?'],
        ],
      ],
      [
        'alta',
        3,
        1,
        [
          [C, 'Informações técnicas, comerciais e prazos confirmadas'],
          [C, 'Objetivo e KPIs definidos'],
          [C, 'Stakeholders, processos e concorrentes conhecidos'],
          [C, 'Business Case construído (ROI e Break-Even)'],
          [P, 'O cliente tem experiências anteriores semelhantes?'],
          [P, 'Quanto estão dispostos a investir? Há valores para "testar a solução"?'],
          [
            P,
            'Qual o impacto em dinheiro (economia)? Os parâmetros técnicos e prazos estão confirmados sem subjetividade?',
          ],
        ],
      ],
      [
        'alta',
        4,
        1,
        [
          [C, 'Cliente e stakeholders convencidos'],
          [C, 'Objeções combatidas'],
          [C, 'Cliente projetando resultados'],
          [
            C,
            'Apresentação contém justificativas do projeto, o que o cliente quer, objetivo + KPI e prazo de implementação',
          ],
          [
            C,
            'Ferramentas do decisor preparadas (4 Blocker, ROI & Breakeven, tempo de instalação, atuais clientes, comparativo técnico-comercial)',
          ],
          [P, 'A equipe impactada está envolvida? O cliente está comprometido com a proposta?'],
          [P, 'O cliente tem opções para declinar? O que o tem motivado?'],
          [P, 'Como faço diferente dos concorrentes? Quem são os stakeholders?'],
          [
            P,
            'Qual o benefício para o cliente? Qual o benefício legado único da ferramenta? Qual o produto e como funciona?',
          ],
        ],
      ],
      [
        'alta',
        5,
        1,
        [
          [C, 'PoC validada'],
          [C, 'Próximos passos confirmados'],
          [C, 'Plano de ação claro e prazo de entrega acordados'],
          [
            C,
            'Padrão de linguagem sem suposições, julgamentos ou generalizações; Rapport estabelecido',
          ],
          [
            C,
            'Confirmação técnica combinada (formulário e relatórios); definido quem faz instalação e manutenções',
          ],
          [
            P,
            'Metodologia aplicada (MAPAN/ZOPA, sinais de compra, gatilhos mentais, 4 estágios: Abertura, Investigação, Demonstração de capacidade, Obtenção de compromisso)?',
          ],
        ],
      ],
      // etapa 6: os 4 insucessos já existem (0028, ordens 1–4)
      [
        'alta',
        6,
        5,
        [
          [C, 'Medidas adotadas e solução instalada'],
          [C, 'Confirmação técnica registrada (formulário e relatórios)'],
        ],
      ],
      [
        'alta',
        7,
        1,
        [
          [C, 'Solução funcionando com indicadores mensuráveis'],
          [C, 'Case coletado'],
          [C, 'Referência comercial solicitada'],
          [P, 'O que amplia ou limita o êxito? Há oportunidades de cross-selling?'],
        ],
      ],
      [
        'alta',
        8,
        1,
        [
          [C, 'Cliente interessado em ampliar'],
          [C, 'Storytelling formatado (WhitePaper/Infográfico)'],
          [P, 'O que funcionou, o que não funcionou, o que mudou?'],
          [P, 'O que o cliente sentiu de mais forte? O que mudou no relacionamento?'],
        ],
      ],
      [
        'baixa',
        1,
        1,
        [
          [C, 'Cenário coletado (volume de envios, frequência de avarias, tipo de embalagem)'],
          [C, 'Necessidade clara identificada e registrada no CRM'],
          [
            P,
            'Qual o impacto anual das avarias, incluindo custos ocultos (seguros, retrabalho, reputação)?',
          ],
          [P, 'Há pontos cegos ou quase-acidentes na operação?'],
        ],
      ],
      [
        'baixa',
        2,
        1,
        [
          [C, 'Necessidade validada com o cliente'],
          [C, 'Solução apresentada de forma tangível (demonstração física ou imagens/QR)'],
          [P, 'Quais os desafios ou lacunas da solução atual (dados em tempo real, precisão)?'],
          [P, 'Há histórico de impactos (G-forces) ou perdas por temperatura/umidade?'],
        ],
      ],
      [
        'baixa',
        3,
        1,
        [
          [
            C,
            'ROI simples calculado e apresentado ("Com X avarias, o produto economiza R$Y por mês")',
          ],
          [C, 'Piloto ou compra inicial de baixo risco proposto'],
          [C, 'Todas as interações e o status registrados no CRM'],
          [P, 'O valor do teste está definido? O retorno paga o investimento em menos de um mês?'],
        ],
      ],
      [
        'baixa',
        4,
        1,
        [
          [C, 'Entrega realizada em até 7 dias'],
          [C, 'Produto instalado e em uso correto confirmado'],
          [C, 'Meta do piloto definida e conhecida pelo cliente'],
          [I, 'Cliente sem instruções de uso do produto'],
          [I, 'Piloto sem meta definida'],
          [I, 'Sem acompanhamento combinado com o cliente'],
        ],
      ],
      [
        'baixa',
        5,
        1,
        [
          [C, 'Follow-up pós-venda realizado (satisfação e uso correto)'],
          [C, 'Oportunidade de recompra/expansão identificada (PUSH 45–120 dias)'],
          [
            P,
            'Os resultados estão conforme o esperado? Há necessidade de ampliar (mais unidades ou novas áreas)?',
          ],
        ],
      ],
    ]

    for (const [trilha, ordemEtapa, ordemInicial, lista] of conteudo) {
      const etapa = app.findFirstRecordByFilter(
        'pipeline_etapas',
        'trilha = {:t} && ordem = {:o}',
        { t: trilha, o: ordemEtapa },
      )
      lista.forEach(([tipo, texto], i) => {
        let existe = null
        try {
          existe = app.findFirstRecordByFilter(
            'etapa_checklist_itens',
            'etapa = {:e} && texto = {:x}',
            { e: etapa.id, x: texto },
          )
        } catch (_) {}
        if (existe) return
        const r = new Record(itens)
        r.set('etapa', etapa.id)
        r.set('ordem', ordemInicial + i)
        r.set('tipo', tipo)
        r.set('texto', texto)
        app.save(r)
      })
    }
  },
  (app) => {
    // remove os itens criados acima (os 4 insucessos da etapa 6 alta, da 0028, ficam)
    const etapasAlta6 = app.findFirstRecordByFilter(
      'pipeline_etapas',
      'trilha = "alta" && ordem = 6',
    )
    const daZeroVinteOito = [
      'Cliente sem instruções de uso da solução',
      'Cliente não sabe qual é a meta da implementação',
      'Sem alinhamento com as demais equipes do cliente',
      'A implementação não gera um entregável',
    ]
    const todos = app.findAllRecords('etapa_checklist_itens')
    for (const r of todos) {
      if (r.get('etapa') === etapasAlta6.id && daZeroVinteOito.indexOf(r.get('texto')) >= 0)
        continue
      try {
        app.delete(r)
      } catch (_) {}
    }
  },
)
