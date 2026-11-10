// EMENDA 1.1a — F1-T03: seed das 8 famílias de templates de diagnóstico.
// Estrutura de cada template: perguntas_json = [{id, bloco, tipo, texto, opcoes?, escala?}]
// Idempotente: só insere se a coleção estiver vazia.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('templates_diagnostico')
    const existing = app.countRecords(col)
    if (existing > 0) return

    const BLOCO_COMUM_CLAIMS = 'claims'
    const BLOCO_COMUM_CONTEXTO = 'contexto'

    const templates = [
      {
        familia: 'Impacto/tombamento descartável',
        tipo: 'tecnico',
        titulo: 'DIAGNÓSTICO SHOCKWATCH®',
        produtos_cobertos:
          'Shockwatch Label, Shockwatch 2, TiltWatch Plus, XTR, ShockWatch MAG2000',
        fonte: 'Diagnóstico Shockwatch® (uploads/070414dd)',
        blocos_comuns: 'identificação do lead; claims; apontamento visual vs gravação; contexto',
        perguntas_json: [
          {
            id: 1,
            bloco: 'manuseio',
            tipo: 'multi',
            texto: 'Quais são os problemas identificados no manuseio?',
            opcoes: ['Queda', 'Inclinação', 'Temperatura', 'Impacto', 'Outro'],
          },
          {
            id: 2,
            bloco: 'perfil_negocio',
            tipo: 'multi',
            texto: 'Os produtos/equipamentos são distribuídos?',
            opcoes: [
              'Não, são ativos de minha empresa e desejo gerenciar o manuseio',
              'Sim, despacho diretamente ao cliente final',
              'Sim, através de um revendedor',
              'Ambas as formas',
            ],
          },
          {
            id: 3,
            bloco: 'perfil_negocio',
            tipo: 'multi',
            texto: 'Esse produto é utilizado?',
            opcoes: ['Pela indústria', 'Por um consumidor final', 'Outro'],
          },
          {
            id: 4,
            bloco: 'perfil_negocio',
            tipo: 'multi',
            texto: 'Os seus clientes iniciais são?',
            opcoes: ['Distribuidores', 'Pontos de venda', 'Consumidores', 'Outro'],
          },
          {
            id: 5,
            bloco: 'perfil_negocio',
            tipo: 'multi',
            texto: 'Os seus clientes finais são?',
            opcoes: [
              'Empresas privadas',
              'Agências de governo',
              'Empresas prestadoras de serviços',
              'Consumidores',
              'Outro',
            ],
          },
          {
            id: 6,
            bloco: 'dimensionamento',
            tipo: 'multi',
            texto: 'Qual é o tipo de modal utilizado para o embarque dos seus produtos?',
            opcoes: ['Rodoviário', 'Ferroviário', 'Aéreo', 'Marítimo', 'Outro'],
          },
          {
            id: 7,
            bloco: 'dimensionamento',
            tipo: 'texto',
            texto: 'Quem paga o frete do produto? De quem é a responsabilidade pelo manuseio?',
          },
          {
            id: 8,
            bloco: 'dimensionamento',
            tipo: 'multi_multi',
            texto: 'Como seus produtos são embalados? (mais de uma opção)',
            opcoes: [
              'Caixas de papelão',
              'Palete',
              'Engradado de madeira',
              'Espuma',
              'Isopor',
              'Plástico bolha',
              'Arqueado',
              'Travesseiro de ar',
              'Sem embalagem',
              'Outro',
            ],
          },
          {
            id: 9,
            bloco: 'dimensionamento',
            tipo: 'dimensoes',
            texto:
              'Quais são as dimensões e peso da embalagem? (comprimento, altura, largura, peso)',
          },
          {
            id: '9.1',
            bloco: 'dimensionamento',
            tipo: 'numero',
            texto: 'Quantidade de embarques por mês?',
          },
          {
            id: '9.2',
            bloco: 'dimensionamento',
            tipo: 'numero',
            texto: 'Qual quantidade produzida/mês?',
          },
          {
            id: '9.3',
            bloco: 'dimensionamento',
            tipo: 'numero',
            texto: 'Qual volume de avarias/mês?',
          },
          {
            id: '9.4',
            bloco: 'dimensionamento',
            tipo: 'numero',
            texto: 'Qual o volume de produtos avariados que são retrabalhados e reaproveitados?',
          },
          {
            id: '9.5',
            bloco: 'dimensionamento',
            tipo: 'numero',
            texto: 'Qual o volume de produtos avariados que são descartados (refugados)?',
          },
          {
            id: '9.6',
            bloco: 'dimensionamento',
            tipo: 'numero',
            texto: 'Qual o preço de venda do produto?',
          },
          {
            id: 10,
            bloco: 'dimensionamento',
            tipo: 'multi',
            texto: 'Como os produtos são embarcados?',
            opcoes: ['Carga fracionada', 'Caminhão cheio', 'Outro'],
          },
          {
            id: 11,
            bloco: 'dimensionamento',
            tipo: 'multi',
            texto: 'O problema normalmente ocorre?',
            opcoes: ['Com materiais recebidos', 'Com materiais embarcados'],
          },
          { id: 12, bloco: 'dimensionamento', tipo: 'sim_nao', texto: 'Pode enviar fotos?' },
          {
            id: 13,
            bloco: BLOCO_COMUM_CLAIMS,
            tipo: 'texto',
            texto:
              'Qual o procedimento adotado pela empresa quando ocorre reclamações e/ou avarias?',
          },
          {
            id: 14,
            bloco: BLOCO_COMUM_CLAIMS,
            tipo: 'sim_nao',
            texto: 'Os registros de "Claims" (apontamento de desvios) são registrados?',
          },
          {
            id: 15,
            bloco: BLOCO_COMUM_CLAIMS,
            tipo: 'multi',
            texto: 'Qual departamento recebe as reclamações (Claims) sobre as avarias?',
            opcoes: ['Logística', 'Comercial', 'Qualidade', 'Outro'],
          },
          {
            id: 16,
            bloco: BLOCO_COMUM_CLAIMS,
            tipo: 'contato',
            texto:
              'Qual é o contato da pessoa responsável pelo controle de Claims? (nome, telefone, e-mail)',
          },
          {
            id: 17,
            bloco: 'monitoramento_atual',
            tipo: 'texto',
            texto:
              'A empresa possui atualmente algum sistema de monitoramento de manuseio? Se sim, descreva.',
          },
          {
            id: 18,
            bloco: 'direcionamento',
            tipo: 'escala',
            texto:
              'O que é mais importante: apontar visualmente a potencial avaria no transporte ou gravar dados de impactos, vibrações, temperatura, localização durante o transporte?',
            escala: 'Apontamento Visual 1-10 | Gravação de Dados 1-10',
          },
          {
            id: 19,
            bloco: BLOCO_COMUM_CONTEXTO,
            tipo: 'multi',
            texto: 'Esta empresa é?',
            opcoes: ['Armazém (fábrica ou Centro de Distribuição-CD)', 'No transporte de carga'],
          },
          {
            id: 20,
            bloco: BLOCO_COMUM_CONTEXTO,
            tipo: 'sim_nao',
            texto: 'Trabalha com produto sensível a temperatura, congelado ou refrigerado?',
          },
          {
            id: 21,
            bloco: BLOCO_COMUM_CONTEXTO,
            tipo: 'multi',
            texto: 'Qual a aplicação?',
            opcoes: ['Monitoramento de máquinas (em uso)', 'Transporte', 'Armazenagem', 'Outros'],
          },
          {
            id: 22,
            bloco: 'direcionamento',
            tipo: 'multi',
            texto: 'Objetivo de monitoramento?',
            opcoes: ['Prevenção', 'Apontamento'],
          },
        ],
      },
      {
        familia: 'Cadeia do frio / indicadores',
        tipo: 'tecnico',
        titulo: 'Qualificação de site - Monitoramento',
        produtos_cobertos: 'WarmMark QR, FreezeSafe QR, HI Cards',
        fonte: 'Qualificação de site - Indicadores (uploads/117e70c9)',
        blocos_comuns: 'claims; apontamento visual vs gravação; contexto',
        perguntas_json: [
          {
            id: 1,
            bloco: 'infra_monitoramento',
            tipo: 'sim_nao',
            texto: 'Já realiza o monitoramento atualmente?',
          },
          {
            id: 2,
            bloco: 'infra_monitoramento',
            tipo: 'sim_nao',
            texto:
              'Há procedimentos para o monitoramento (registros de máx e mín, %, intervalos de leitura)?',
          },
          {
            id: 3,
            bloco: 'infra_monitoramento',
            tipo: 'multi',
            texto: 'Como os dados coletados são registrados e armazenados?',
            opcoes: ['Manualmente', 'Planilhas', 'Outro'],
          },
          {
            id: 4,
            bloco: 'infra_monitoramento',
            tipo: 'texto',
            texto: 'Quais os locais/equipamentos a serem monitorados?',
          },
          {
            id: 5,
            bloco: 'infra_monitoramento',
            tipo: 'variavel',
            texto:
              'Quais as variáveis mín/máx e precisão a serem monitoradas (ex.: -10 a +90 °C ± 0.5 °C)?',
          },
          {
            id: 6,
            bloco: 'infra_monitoramento',
            tipo: 'multi',
            texto:
              'Deseja que os dados coletados sejam armazenados em servidor próprio ou nosso servidor-nuvem?',
            opcoes: ['Servidor próprio', 'Servidor-nuvem AHM'],
          },
          {
            id: 7,
            bloco: BLOCO_COMUM_CLAIMS,
            tipo: 'texto',
            texto:
              'Qual o procedimento adotado pela empresa quando ocorre reclamações e/ou avarias?',
          },
          {
            id: 8,
            bloco: BLOCO_COMUM_CLAIMS,
            tipo: 'sim_nao',
            texto: 'Os registros de "Claims" são registrados?',
          },
          {
            id: 9,
            bloco: BLOCO_COMUM_CLAIMS,
            tipo: 'multi',
            texto: 'Qual departamento recebe as reclamações (Claims) sobre as avarias?',
            opcoes: ['Logística', 'Comercial', 'Qualidade', 'Outro'],
          },
          {
            id: 10,
            bloco: 'direcionamento',
            tipo: 'escala',
            texto:
              'O que é mais importante: apontar visualmente a potencial avaria no transporte ou gravar dados de variação de temperatura, umidade, pressão, localização durante o transporte?',
            escala: 'Apontamento Visual 1-10 | Gravação de Dados 1-10',
          },
          {
            id: 11,
            bloco: BLOCO_COMUM_CONTEXTO,
            tipo: 'multi',
            texto: 'Meu cliente é?',
            opcoes: ['Armazém (fábrica ou Centro de Distribuição-CD)', 'No transporte de carga'],
          },
        ],
      },
      {
        familia: 'Registradores de impacto',
        tipo: 'tecnico',
        titulo: 'DIAGNÓSTICO SHOCKLOG',
        produtos_cobertos: 'ShockLog 298, SpotBot 4G, Data Loggers',
        fonte:
          'Diagnóstico Registrador de Impacto (uploads/97112bad) + Cenário Atual Shocklog (uploads/5a208709)',
        blocos_comuns: 'identificação do lead; projeto vs sondagem',
        perguntas_json: [
          {
            id: 1,
            bloco: 'projeto',
            tipo: 'multi',
            texto:
              'Esta avaliação tem como finalidade a criação de um projeto ou é apenas uma sondagem de viabilidade?',
            opcoes: ['Criação de um projeto', 'Sondagem de viabilidade'],
          },
          {
            id: 2,
            bloco: 'especificacao',
            tipo: 'multi',
            texto: 'Qual será a frequência de utilização do registrador de impacto?',
            opcoes: ['Semanal', 'Mensal', 'Raramente'],
          },
          {
            id: 3,
            bloco: 'especificacao',
            tipo: 'sim_nao_cond',
            texto:
              'Além do impacto, há limite/tolerância de inclinação para o equipamento transportado? Se sim, qual é esse limite?',
          },
          {
            id: 4,
            bloco: 'especificacao',
            tipo: 'sim_nao',
            texto: 'É necessário o rastreamento via GPS?',
          },
          {
            id: 5,
            bloco: 'especificacao',
            tipo: 'sim_nao',
            texto:
              'É necessário o monitoramento em tempo real durante a utilização do equipamento?',
          },
          {
            id: 6,
            bloco: 'especificacao',
            tipo: 'sim_nao',
            texto: 'É necessário indicar para o motorista sobre excesso de impacto ou vibração?',
          },
          {
            id: 7,
            bloco: 'especificacao',
            tipo: 'sim_nao',
            texto: 'É necessário monitoramento de temperatura, pressão, umidade e inclinação?',
          },
          {
            id: 8,
            bloco: 'especificacao',
            tipo: 'sim_nao_cond',
            texto:
              'Além do Registrador de Impacto, considera pertinente o uso de Indicador de Impacto Descartável nas embalagens? Se sim, informe peso e dimensão das embalagens.',
          },
          {
            id: 9,
            bloco: 'especificacao',
            tipo: 'sim_nao_cond',
            texto:
              'O equipamento a ser transportado suporta qual aceleração em G (impacto e vibração)? Se sim, quais os limites nos eixos X, Y e Z?',
          },
          {
            id: 10,
            bloco: 'especificacao',
            tipo: 'sim_nao_cond',
            texto:
              'O equipamento possui base de fixação para o registrador de impacto? Se sim, poderia nos enviar uma foto?',
          },
          {
            id: 11,
            bloco: 'especificacao',
            tipo: 'sim_nao',
            texto: 'Sua empresa possui logística reversa?',
          },
          {
            id: 12,
            bloco: 'especificacao',
            tipo: 'multi',
            texto: 'Qual é o valor do equipamento a ser transportado, em ordem de grandeza?',
            opcoes: ['≤ R$ 50.000', '≥ R$ 50.000', '> R$ 500.000'],
          },
        ],
      },
      {
        familia: 'Registradores de impacto',
        tipo: 'cenario',
        titulo: 'Cenário Atual – Shocklog',
        produtos_cobertos: 'ShockLog 298, SpotBot 4G, Data Loggers',
        fonte: 'Cenário Atual Shocklog (uploads/5a208709)',
        blocos_comuns: 'reflexão comercial (SPIN-like)',
        perguntas_json: [
          {
            id: 1,
            bloco: 'cenario',
            tipo: 'reflexao',
            texto:
              'Atualmente como você acredita que fornecer informações em tempo real de como a carga está sendo transportada (apresentar para seu cliente excesso de impactos, vibrações) podem ajudar a sua relação comercial com seu cliente?',
          },
          {
            id: 2,
            bloco: 'cenario',
            tipo: 'reflexao',
            texto:
              'Atualmente possuem interesse em demonstrar para seus clientes as condições de como as cargas durante o transporte?',
          },
          {
            id: 3,
            bloco: 'cenario',
            tipo: 'reflexao',
            texto:
              'Hoje como vocês evidenciam para os clientes de que realizaram o transporte em perfeitas condições?',
          },
          {
            id: 4,
            bloco: 'cenario',
            tipo: 'reflexao',
            texto:
              'Atualmente qual seria um empecilho para adotar um método digital que possa averiguar e certificar que a carga foi transportada corretamente, dentro dos mais altos critérios de qualidade?',
          },
          {
            id: 5,
            bloco: 'cenario',
            tipo: 'reflexao',
            texto:
              'Quais informações você considera importante transmitir para o seu cliente em tempo real, as quais você não tem hoje disponível?',
          },
        ],
      },
      {
        familia: 'Segurança/proximidade',
        tipo: 'tecnico',
        titulo: 'DIAGNÓSTICO HIT-NOT®',
        produtos_cobertos:
          'Hit-Not, Iris860, Iris-i, Proxicam, Farol Blue Spotlight, Red Light (Red Zone)',
        fonte:
          'Diagnóstico HIT-NOT (uploads/c42289b8) — obs: perguntas 17 e 24 duplicadas no original; consolidadas em uma',
        blocos_comuns: 'identificação do lead; projeto vs sondagem',
        perguntas_json: [
          {
            id: 1,
            bloco: 'projeto',
            tipo: 'multi',
            texto:
              'Esta avaliação tem como finalidade a criação de um projeto ou é apenas uma sondagem de viabilidade?',
            opcoes: ['Criação de um projeto', 'Sondagem de viabilidade'],
          },
          {
            id: 2,
            bloco: 'seguranca',
            tipo: 'sim_nao',
            texto: 'Cumprem alguma padronização de segurança?',
          },
          {
            id: 3,
            bloco: 'seguranca',
            tipo: 'numero',
            texto:
              'Qual é a distância segura que os pedestres vulneráveis devem permanecer próximos aos veículos?',
          },
          {
            id: 4,
            bloco: 'frota',
            tipo: 'frota',
            texto:
              'Dados das empilhadeiras e demais veículos: marca, modelo, quantidade, voltagem, frota própria?',
          },
          {
            id: 5,
            bloco: 'frota',
            tipo: 'numero',
            texto: 'Quantas empilhadeiras e/ou rebocadores são utilizadas?',
          },
          {
            id: 6,
            bloco: 'frota',
            tipo: 'multi',
            texto: 'As empilhadeiras se deslocam em qual sentido?',
            opcoes: ['Frente', 'Frente e Ré'],
          },
          { id: 7, bloco: 'seguranca', tipo: 'texto', texto: 'Há pontos cegos? Descreva.' },
          {
            id: 8,
            bloco: 'operacao',
            tipo: 'multi_multi',
            texto: 'Que tipo de material movimenta?',
            opcoes: ['Sacaria', 'Caixa de papelão', 'Bobinas', 'Fardos', 'Paletes', 'Bebidas'],
          },
          { id: 9, bloco: 'seguranca', tipo: 'sim_nao', texto: 'Possui plano de tráfego?' },
          {
            id: 10,
            bloco: 'operacao',
            tipo: 'multi_multi',
            texto:
              'Há fluxo de pedestres e empilhadeiras simultaneamente, com os seguintes equipamentos em funcionamento?',
            opcoes: [
              'Auto-forno',
              'Balança',
              'Painel elétrico',
              'Transformadores de energia',
              'Motores',
              'Casa de Bombas',
              'Trefiladeiras',
            ],
          },
          {
            id: 11,
            bloco: 'seguranca',
            tipo: 'numero',
            texto: 'Quantidade de pedestres vulneráveis?',
          },
          { id: 12, bloco: 'seguranca', tipo: 'sim_nao', texto: 'Utilizam colete refletivo?' },
          { id: 13, bloco: 'ponte_rolante', tipo: 'sim_nao', texto: 'Possui Ponte Rolante?' },
          {
            id: 14,
            bloco: 'ponte_rolante',
            tipo: 'multi',
            texto: 'O time de manutenção da Ponte Rolante é próprio ou terceiro?',
            opcoes: ['Próprio', 'Terceiro'],
          },
          {
            id: 15,
            bloco: 'ponte_rolante',
            tipo: 'texto',
            texto: 'Qual é o tipo de material transportado pela Ponte-Rolante?',
          },
          {
            id: 16,
            bloco: 'ponte_rolante',
            tipo: 'numero',
            texto: 'Poderia informar a altura da ponte em relação ao piso?',
          },
          {
            id: 17,
            bloco: 'integracao',
            tipo: 'sim_nao',
            texto:
              'Possui interesse em integrar ao Hit-Not®: acionamento de luz de segurança ou abertura/fechamento de portas, portões etc.? (consolida 17+24 do original)',
          },
          { id: 18, bloco: 'operacao', tipo: 'numero', texto: 'Quantos turnos tem sua operação?' },
          {
            id: 19,
            bloco: 'operacao',
            tipo: 'multi',
            texto: 'As operações são realizadas em área?',
            opcoes: ['Aberta', 'Fechada', 'Ambas'],
          },
          {
            id: 20,
            bloco: 'operacao',
            tipo: 'multi',
            texto: 'Qual é o atual nível de ruído existente?',
            opcoes: ['Alto — acima de 85dB', 'Baixo — abaixo de 75dB'],
          },
          {
            id: 21,
            bloco: 'seguranca',
            tipo: 'sim_nao',
            texto:
              'Há área de exclusão nas operações? (áreas onde há barreira física que protege os pedestres: faixa de pedestres, escritórios, sala de reunião etc.)',
          },
          {
            id: 22,
            bloco: 'seguranca',
            tipo: 'texto',
            texto: 'Qual é a atividade de risco que a empilhadeira executa?',
          },
          {
            id: 23,
            bloco: 'seguranca',
            tipo: 'sim_nao',
            texto: 'Teve alguma experiência anterior com sistema de detecção?',
          },
        ],
      },
      {
        familia: 'Segurança/proximidade',
        tipo: 'cenario',
        titulo: 'Cenário Atual | Hit Not/Iris',
        produtos_cobertos: 'Hit-Not, Iris860, Iris-i',
        fonte: 'Cenário Atual Hit Not/Iris (uploads/73bd02fc)',
        blocos_comuns: 'reflexão comercial',
        perguntas_json: [
          {
            id: 1,
            bloco: 'cenario',
            tipo: 'reflexao',
            texto:
              'Atualmente tem interesse em controlar o risco de acidente/colisão/atropelamento entre empilhadeiras e pedestres?',
          },
          {
            id: 2,
            bloco: 'cenario',
            tipo: 'reflexao',
            texto:
              'Na operação vocês possuem pontos-cegos (cruzamentos, material empilhado, fumaça, sistema porta-palete, caminhões) — locais onde o operador do veículo não consegue estabelecer contato visual com os pedestres?',
          },
          {
            id: 3,
            bloco: 'cenario',
            tipo: 'reflexao',
            texto: 'Qual é a velocidade permitida dos veículos?',
          },
          {
            id: 4,
            bloco: 'cenario',
            tipo: 'reflexao',
            texto: 'Utilizam colete refletivo de segurança?',
          },
        ],
      },
      {
        familia: 'Assessoria de plano de tráfego',
        tipo: 'auditoria',
        titulo: 'DIAGNÓSTICO SEGURANÇA VIÁRIA',
        produtos_cobertos:
          'Linha Consultoria — assessoria de plano de tráfego/Risk Assessment (ISO)',
        fonte:
          'Diagnóstico Segurança Viária (uploads/10d99233) + Checklist de Autoavaliação AHM (uploads/92ed4b55)',
        blocos_comuns: 'cada pergunta: CUMPRE Sim/Não + Observações',
        perguntas_json: [
          {
            id: 1,
            bloco: 'politica',
            tipo: 'cumpre',
            texto:
              'A política de segurança e tráfego é estabelecida de acordo com as diretrizes da companhia?',
          },
          {
            id: 2,
            bloco: 'politica',
            tipo: 'cumpre',
            texto:
              'A companhia adota uma abordagem de processo de forma transparente, envolvendo todos os níveis da organização?',
          },
          {
            id: 3,
            bloco: 'politica',
            tipo: 'cumpre',
            texto:
              'As atividades, processos (formais e informais) e funções da empresa que afetam a segurança no tráfego foram identificados?',
          },
          {
            id: 4,
            bloco: 'politica',
            tipo: 'cumpre',
            texto:
              'As partes interessadas que podem ser afetadas pela segurança no tráfego foram identificadas?',
          },
          {
            id: 5,
            bloco: 'requisitos',
            tipo: 'cumpre',
            texto:
              'Os requisitos legais relacionados às rotas e plano de tráfego que afetam a organização foram determinados?',
          },
          {
            id: 6,
            bloco: 'requisitos',
            tipo: 'cumpre',
            texto:
              'A gerência garante que as responsabilidades para gestão do plano de tráfego e rotas sejam atribuídas e comunicadas dentro da organização?',
          },
          {
            id: 7,
            bloco: 'requisitos',
            tipo: 'cumpre',
            texto:
              'A gerência foi designada a cumprir os requisitos básicos do plano de tráfego e rotas?',
          },
          {
            id: 8,
            bloco: 'riscos',
            tipo: 'cumpre',
            texto:
              'Existe algum processo que analisa o desempenho atual do plano de tráfego, no qual os riscos e oportunidades são determinados?',
          },
          {
            id: 9,
            bloco: 'riscos',
            tipo: 'cumpre',
            texto: 'Os fatores de exposição ao risco foram identificados?',
          },
          {
            id: 10,
            bloco: 'riscos',
            tipo: 'cumpre',
            texto: 'A organização planeja ações para lidar com riscos e oportunidades?',
          },
          {
            id: 11,
            bloco: 'riscos',
            tipo: 'cumpre',
            texto: 'A eficácia de suas ações para o plano de tráfego é avaliada?',
          },
          {
            id: 12,
            bloco: 'competencias',
            tipo: 'cumpre',
            texto:
              'São determinadas as competências necessárias das pessoas com responsabilidades no plano de tráfego?',
          },
          {
            id: 13,
            bloco: 'mitigacao',
            tipo: 'cumpre',
            texto: 'É possível realocar as atividades de pedestres vulneráveis para áreas seguras?',
          },
          {
            id: 14,
            bloco: 'mitigacao',
            tipo: 'cumpre',
            texto: 'É possível substituir as atividades atuais (por exemplo, com automação)?',
          },
          {
            id: 15,
            bloco: 'mitigacao',
            tipo: 'cumpre',
            texto:
              'É possível definir novas rotas de tráfego de pedestres (exclusivas e/ou compartilhadas com equipamentos móveis)?',
          },
          {
            id: 16,
            bloco: 'mitigacao',
            tipo: 'cumpre',
            texto: 'É possível alterar o fluxo de equipamentos móveis?',
          },
          {
            id: 17,
            bloco: 'mitigacao',
            tipo: 'cumpre',
            texto: 'É possível mover os produtos armazenados (estoques temporários)?',
          },
        ],
      },
      {
        familia: 'Visibilidade/câmeras',
        tipo: 'tecnico',
        titulo: 'Diagnóstico – Câmera',
        produtos_cobertos: 'Câmera Empilhadeira Sem-Fio, Orlaco, Motec',
        fonte: 'Diagnóstico – Câmera (uploads/6d162a75)',
        blocos_comuns: 'projeto vs sondagem',
        perguntas_json: [
          {
            id: 1,
            bloco: 'projeto',
            tipo: 'multi',
            texto:
              'Esta avaliação tem como finalidade a criação de um projeto ou é apenas uma sondagem de viabilidade?',
            opcoes: ['Criação de um projeto', 'Sondagem de viabilidade'],
          },
          {
            id: 2,
            bloco: 'equipamento',
            tipo: 'frota',
            texto:
              'Dados das empilhadeiras: marca, modelo, ano. Em caso de operações em câmeras frigoríficas, sua empilhadeira tem cabine refrigerada?',
          },
          {
            id: 3,
            bloco: 'historico',
            tipo: 'reflexao',
            texto:
              'Possui alguma experiência com câmera em empilhadeiras? Se sim, quais lições poderia compartilhar?',
          },
          {
            id: 4,
            bloco: 'necessidade',
            tipo: 'reflexao',
            texto:
              'Descreva em poucas palavras como o sistema de câmera poderá lhe auxiliar na operação.',
          },
          {
            id: 5,
            bloco: 'equipamento',
            tipo: 'numero',
            texto: 'Quantos estágios possui a torre?',
          },
          {
            id: 6,
            bloco: 'equipamento',
            tipo: 'sim_nao',
            texto: 'A empilhadeira sofreu algum tipo de alteração na torre?',
          },
          {
            id: 7,
            bloco: 'necessidade',
            tipo: 'multi',
            texto: 'Qual é o maior interesse no sistema de câmera?',
            opcoes: [
              'Eliminar excesso de colisões',
              'Ampliar segurança e produtividade',
              'Problemas relacionados a ergonomia',
            ],
          },
          {
            id: 8,
            bloco: 'equipamento',
            tipo: 'sim_nao_cond',
            texto:
              'A empilhadeira possui algum tipo de implemento instalado (Garra de Bobinas/Clamp, Garra para fardo, Garfo Telescópico, Sistema Pantográfico etc.)?',
          },
          { id: 9, bloco: 'frota', tipo: 'numero', texto: 'Qual é a quantidade de empilhadeiras?' },
          {
            id: 10,
            bloco: 'frota',
            tipo: 'sim_nao_cond',
            texto:
              'A frota de empilhadeiras é própria ou alugada? Se alugadas, poderia compartilhar dados do locador (empresa e contato)?',
          },
          {
            id: 11,
            bloco: 'necessidade',
            tipo: 'sim_nao_cond',
            texto: 'Possui interesse em visão dos garfos? Se sim, qual é o pé direito do armazém?',
          },
        ],
      },
      {
        familia: 'Palletless',
        tipo: 'tecnico',
        titulo: 'Diagnóstico Push-Pull / RollerForks (base)',
        produtos_cobertos: 'Push-Pull, RollerForks',
        fonte:
          'Diagnóstico Push-Pull (uploads/22b8491f) + RollerForks (uploads/421efdcf) + 5 variantes por tipo de carga (Big Bags, Chapas, Fardo, Sacaria manual, Sacaria c/palete)',
        blocos_comuns:
          'núcleo palletless: dimensões, fotos, fornecedor slipsheets, custo/hora/homem, caminhões/dia, embarques/mês, estudo de otimização',
        perguntas_json: [
          {
            id: 1,
            bloco: 'objetivo',
            tipo: 'sim_nao',
            texto: 'Deseja eliminar paletes no transporte?',
          },
          {
            id: 2,
            bloco: 'projeto',
            tipo: 'multi',
            texto:
              'Esta avaliação tem como finalidade a criação de um projeto ou é apenas uma sondagem de viabilidade?',
            opcoes: ['Criação de um projeto', 'Sondagem de viabilidade'],
          },
          {
            id: 3,
            bloco: 'carga',
            tipo: 'multi',
            texto: 'Qual produto manuseia?',
            opcoes: ['Sacaria', 'Big bag', 'Caixas', 'Bebidas', 'Fardos', 'Chapas', 'Outros'],
          },
          {
            id: 4,
            bloco: 'carga',
            tipo: 'dimensoes',
            texto: 'Qual o tamanho do palete/Big Bag/produto (comprimento, altura, largura, peso)?',
          },
          {
            id: 5,
            bloco: 'carga',
            tipo: 'sim_nao',
            texto: 'É possível fornecer fotos dos produtos existentes?',
          },
          {
            id: 6,
            bloco: 'operacao',
            tipo: 'sim_nao',
            texto: 'Atualmente realiza operações de (des)carregamento manualmente?',
          },
          {
            id: 7,
            bloco: 'equipamento',
            tipo: 'frota',
            texto: 'Possui empilhadeira? Marca, modelo, capacidade.',
          },
          {
            id: '8-PP',
            bloco: 'equipamento',
            tipo: 'sim_nao',
            texto: '[Push-Pull] Sua empilhadeira possui 4ª via hidráulica instalada?',
          },
          {
            id: '8-RF',
            bloco: 'operacao',
            tipo: 'sim_nao',
            texto: '[RollerForks] É realizado o duplo empilhamento da carga?',
          },
          {
            id: '9-RF',
            bloco: 'operacao',
            tipo: 'sim_nao',
            texto:
              '[RollerForks] Deseja realizar a operação de (des)carregamento apenas de um lado do caminhão?',
          },
          {
            id: '10-RF',
            bloco: 'operacao',
            tipo: 'sim_nao_cond',
            texto:
              '[RollerForks] Deseja realizar a operação pela parte traseira do caminhão? Se sim, confirme as características do veículo.',
          },
          {
            id: '11-RF',
            bloco: 'operacao',
            tipo: 'sim_nao',
            texto: '[RollerForks] Sua empresa possui plataforma elevatória para (des)carregamento?',
          },
          {
            id: 12,
            bloco: 'operacao',
            tipo: 'multi',
            texto: 'De que lado deseja (des)carregar palete/Big Bag/produto?',
            opcoes: ['Do lado menor', 'Do lado maior', 'Ambos'],
          },
          {
            id: 13,
            bloco: 'operacao',
            tipo: 'multi',
            texto: 'Qual operação deseja realizar?',
            opcoes: ['Carregamento', 'Descarregamento', 'Ambos'],
          },
          {
            id: 14,
            bloco: 'carga',
            tipo: 'sim_nao',
            texto: 'A carga utiliza o filme "stretch" para proteger?',
          },
          { id: 15, bloco: 'slipsheets', tipo: 'sim_nao', texto: 'Conhece a folha Slip Sheets?' },
          {
            id: 16,
            bloco: 'slipsheets',
            tipo: 'sim_nao',
            texto: 'Deseja contatos de fornecedores de folhas?',
          },
        ],
      },
      {
        familia: 'Trocador/Transferidor de paletes',
        tipo: 'tecnico',
        titulo: 'DIAGNÓSTICO TRANSFERIDOR DE PALETES',
        produtos_cobertos: 'Trocador/Transferidor de Paletes',
        fonte:
          'Diagnóstico Transferidor de Paletes (uploads/b67055fc, 2021) + Qualificação Técnica Manual de Vendas (uploads/e8ea0bc3) — documentos idênticos',
        blocos_comuns: 'identificação do lead; projeto vs sondagem; núcleo palletless',
        perguntas_json: [
          {
            id: 1,
            bloco: 'projeto',
            tipo: 'multi',
            texto:
              'Esta avaliação tem como finalidade a criação de um projeto ou é apenas uma sondagem de viabilidade?',
            opcoes: ['Criação de um projeto', 'Sondagem de viabilidade'],
          },
          {
            id: 2,
            bloco: 'operacao',
            tipo: 'texto',
            texto: 'Atualmente como é realizada a transferência de carga?',
          },
          {
            id: 3,
            bloco: 'capacidade',
            tipo: 'numero',
            texto: 'Quantos volumes de transferência (paletes/minuto) deseja executar?',
          },
          {
            id: 4,
            bloco: 'carga',
            tipo: 'multi',
            texto: 'Qual produto manuseia?',
            opcoes: ['Sacaria', 'Big bag', 'Caixas', 'Bebidas', 'Fardos', 'Chapas', 'Outros'],
          },
          { id: 5, bloco: 'carga', tipo: 'numero', texto: 'Qual o peso da carga?' },
          {
            id: 6,
            bloco: 'carga',
            tipo: 'dimensoes',
            texto: 'Qual é o tamanho (A x L x C) dos paletes a serem utilizados?',
          },
          {
            id: 7,
            bloco: 'carga',
            tipo: 'sim_nao',
            texto:
              'É possível compartilhar fotos da carga que deseja executar a operação de transferência?',
          },
          {
            id: 8,
            bloco: 'projeto',
            tipo: 'texto',
            texto: 'Existe um cronograma de implementação (deadline do projeto)?',
          },
          {
            id: 9,
            bloco: 'projeto',
            tipo: 'sim_nao',
            texto: 'Além da AHM, estão cotando com outras empresas?',
          },
          {
            id: 10,
            bloco: 'infra',
            tipo: 'sim_nao',
            texto: 'Há disponível fonte de alimentação 3ph/400V/16A/60Hz no seu armazém?',
          },
        ],
      },
      {
        familia: 'Eficiência industrial',
        tipo: 'qualificacao_consultiva',
        titulo: 'Assessment AHM — Roteiro de Qualificação Consultiva (BANT)',
        produtos_cobertos: 'Thermax (fitas térmicas)',
        fonte:
          'Assessment AHM — Roteiro de Qualificação Consultiva (uploads/6edb24aa) — regra de ouro RN-1.5: nunca apresentar produto antes de completar o diagnóstico',
        blocos_comuns:
          'BANT (Budget/Authority/Need/Timeline); blocos condicionais por vertical; sinais verdes/vermelhos; ROI',
        perguntas_json: [
          {
            id: 'B0.1',
            bloco: 'abertura',
            tipo: 'reflexao',
            texto:
              'Como vocês garantem hoje, de forma documentada, que a temperatura crítica do processo foi realmente atingida?',
          },
          {
            id: 'B0.2',
            bloco: 'abertura',
            tipo: 'reflexao',
            texto:
              'Se eu pedisse a evidência de um lote processado na semana passada, quanto tempo vocês levariam para me entregar?',
          },
          {
            id: 'B0.3',
            bloco: 'abertura',
            tipo: 'reflexao',
            texto:
              'Quem na operação é responsável por provar conformidade térmica quando há uma auditoria?',
          },
          {
            id: 'B0.4',
            bloco: 'abertura',
            tipo: 'reflexao',
            texto: 'O que mudou no processo de vocês nos últimos 12 meses?',
          },
          {
            id: 'B1.1',
            bloco: 'budget',
            tipo: 'reflexao',
            texto:
              'Qual foi o custo do último lote ou material descartado por falha de processo térmico?',
          },
          {
            id: 'B1.2',
            bloco: 'budget',
            tipo: 'numero',
            texto: 'Quantas reprocessagens ou retrabalhos por mês estão ligados a temperatura?',
          },
          {
            id: 'B1.3',
            bloco: 'budget',
            tipo: 'reflexao',
            texto:
              'Existe parada não planejada por superaquecimento de motor, painel elétrico ou componente? Qual o custo por hora parada?',
          },
          {
            id: 'B1.4',
            bloco: 'budget',
            tipo: 'reflexao',
            texto:
              'Quanto custa hoje manter calibração e manutenção de sensores e termômetros digitais?',
          },
          {
            id: 'B1.5',
            bloco: 'budget',
            tipo: 'sim_nao',
            texto: 'Já houve glosa, devolução de cliente ou multa sanitária associada a esse tema?',
          },
          {
            id: 'B2.1',
            bloco: 'authority',
            tipo: 'reflexao',
            texto: 'Quem assina a aprovação técnica de um novo item de monitoramento?',
          },
          {
            id: 'B2.2',
            bloco: 'authority',
            tipo: 'reflexao',
            texto:
              'Qualidade, Manutenção, CME e Engenharia participam da decisão ou apenas uma área?',
          },
          {
            id: 'B2.3',
            bloco: 'authority',
            tipo: 'sim_nao',
            texto: 'Existe comitê de segurança ou de HACCP que precisa validar?',
          },
          {
            id: 'B2.4',
            bloco: 'authority',
            tipo: 'reflexao',
            texto: 'Quem sofre a consequência quando uma auditoria aponta falha?',
          },
          {
            id: 'B3.1',
            bloco: 'need',
            tipo: 'reflexao',
            texto:
              'Onde exatamente vocês medem a temperatura hoje? E onde vocês NÃO conseguem medir?',
          },
          {
            id: 'B3.2',
            bloco: 'need',
            tipo: 'multi',
            texto: 'O sensor que vocês usam mede o ar, a superfície ou o interior do material?',
            opcoes: ['Ar', 'Superfície', 'Interior', 'Combinação'],
          },
          {
            id: 'B3.3',
            bloco: 'need',
            tipo: 'reflexao',
            texto:
              'Vocês têm registro permanente da temperatura atingida ou apenas a leitura do momento?',
          },
          {
            id: 'B3.4',
            bloco: 'need',
            tipo: 'reflexao',
            texto:
              'O que acontece se a energia cair no meio do ciclo? Vocês sabem depois se a temperatura foi atingida?',
          },
          {
            id: 'B3.5',
            bloco: 'need',
            tipo: 'reflexao',
            texto:
              'Como vocês provam conformidade de um equipamento que já saiu da fábrica ou de um material que já foi para o cliente?',
          },
          {
            id: 'B3.6',
            bloco: 'need',
            tipo: 'reflexao',
            texto:
              'Já aconteceu de descobrirem tarde demais que um equipamento não atingia a temperatura nominal? Como descobriram?',
          },
          {
            id: 'B3.7',
            bloco: 'need',
            tipo: 'reflexao',
            texto:
              'Quem faz a verificação e com que frequência? Existe ponto cego entre as verificações?',
          },
          {
            id: 'B3.8',
            bloco: 'need',
            tipo: 'reflexao',
            texto:
              'Se o processo térmico falhar hoje, qual é o pior cenário — segurança de paciente, recall, perda de certificação, acidente?',
          },
          {
            id: 'B4.1',
            bloco: 'timeline',
            tipo: 'sim_nao_cond',
            texto: 'Existe auditoria, certificação ou inspeção prevista nos próximos meses?',
          },
          {
            id: 'B4.2',
            bloco: 'timeline',
            tipo: 'sim_nao_cond',
            texto: 'Há alguma meta de redução de descarte ou de parada não planejada neste ciclo?',
          },
          {
            id: 'B4.3',
            bloco: 'timeline',
            tipo: 'reflexao',
            texto: 'Quando vocês precisam ter a evidência documentada disponível?',
          },
          {
            id: 'B4.4',
            bloco: 'timeline',
            tipo: 'reflexao',
            texto: 'Se aprovado, em quanto tempo conseguiriam implementar na linha?',
          },
          {
            id: 'V-S1',
            bloco: 'vertical_saude',
            tipo: 'condicional',
            texto:
              '[Saúde/CME] Quantas autoclaves e lavadoras térmicas vocês têm e qual o ciclo de cada uma?',
          },
          {
            id: 'V-S2',
            bloco: 'vertical_saude',
            tipo: 'condicional',
            texto:
              '[Saúde/CME] Vocês usam indicador químico classe 1 a 6? Qual classe e como arquivam?',
          },
          {
            id: 'V-S3',
            bloco: 'vertical_saude',
            tipo: 'condicional',
            texto:
              '[Saúde/CME] Como vocês comprovam que a lavadora atingiu 71°C ou 82°C, e não apenas que o ciclo terminou?',
          },
          {
            id: 'V-S4',
            bloco: 'vertical_saude',
            tipo: 'condicional',
            texto:
              '[Saúde/CME] O registro do indicador é anexado ao prontuário ou à rastreabilidade do material?',
          },
          {
            id: 'V-S5',
            bloco: 'vertical_saude',
            tipo: 'condicional',
            texto:
              '[Saúde/CME] Já tiveram apontamento de auditoria da vigilância sanitária sobre validação de desinfecção?',
          },
          {
            id: 'V-S6',
            bloco: 'vertical_saude',
            tipo: 'condicional',
            texto: '[Saúde/CME] Quem na CME faz a leitura e o arquivamento dos indicadores?',
          },
          {
            id: 'V-I1',
            bloco: 'vertical_industria',
            tipo: 'condicional',
            texto:
              '[Indústria] Quantos motores, painéis e quadros críticos vocês têm? Existe inventário?',
          },
          {
            id: 'V-I2',
            bloco: 'vertical_industria',
            tipo: 'condicional',
            texto:
              '[Indústria] Como vocês detectam superaquecimento hoje (termografia periódica, sensor, inspeção visual)?',
          },
          {
            id: 'V-I3',
            bloco: 'vertical_industria',
            tipo: 'condicional',
            texto:
              '[Indústria] Qual a frequência da termografia e o que acontece entre uma inspeção e outra?',
          },
          {
            id: 'V-I4',
            bloco: 'vertical_industria',
            tipo: 'condicional',
            texto:
              '[Indústria] Já perderam motor, painel ou rolamento por superaquecimento? Qual o custo total incluindo parada?',
          },
          {
            id: 'V-I5',
            bloco: 'vertical_industria',
            tipo: 'condicional',
            texto: '[Indústria] Existe plano de manutenção preditiva ou é corretiva?',
          },
          {
            id: 'V-I6',
            bloco: 'vertical_industria',
            tipo: 'condicional',
            texto:
              '[Indústria] Vocês precisam de evidência de que o componente não excedeu a temperatura em garantia ou em laudo?',
          },
          {
            id: 'V-A1',
            bloco: 'vertical_alimentos',
            tipo: 'condicional',
            texto:
              '[Alimentos/HACCP] Quais são os Pontos Críticos de Controle térmicos do seu fluxograma?',
          },
          {
            id: 'V-A2',
            bloco: 'vertical_alimentos',
            tipo: 'condicional',
            texto:
              '[Alimentos/HACCP] Como vocês registram a temperatura na recepção, no armazenamento e no transporte?',
          },
          {
            id: 'V-A3',
            bloco: 'vertical_alimentos',
            tipo: 'condicional',
            texto:
              '[Alimentos/HACCP] O que acontece se a câmara fria falhar durante a madrugada? Quem sabe e quando?',
          },
          {
            id: 'V-A4',
            bloco: 'vertical_alimentos',
            tipo: 'condicional',
            texto:
              '[Alimentos/HACCP] Vocês conseguem provar que um pallet não sofreu excursão térmica depois de sair da doca?',
          },
          {
            id: 'V-A5',
            bloco: 'vertical_alimentos',
            tipo: 'condicional',
            texto:
              '[Alimentos/HACCP] Já tiveram perda de carga ou devolução por ruptura de cadeia fria?',
          },
          {
            id: 'V-A6',
            bloco: 'vertical_alimentos',
            tipo: 'condicional',
            texto: '[Alimentos/HACCP] Como o HACCP documenta a verificação dos PCCs hoje?',
          },
          {
            id: 'V-T1',
            bloco: 'vertical_textil',
            tipo: 'condicional',
            texto:
              '[Têxtil] Quais processos térmicos vocês controlam: lavagem, secagem, cura, tingimento, prensagem?',
          },
          {
            id: 'V-T2',
            bloco: 'vertical_textil',
            tipo: 'condicional',
            texto:
              '[Têxtil] Como garantem que a temperatura de lavagem foi atingida em toda a carga, e não só no sensor da máquina?',
          },
          {
            id: 'V-T3',
            bloco: 'vertical_textil',
            tipo: 'condicional',
            texto:
              '[Têxtil] Existe exigência de cliente ou marca sobre comprovação de temperatura?',
          },
          {
            id: 'V-T4',
            bloco: 'vertical_textil',
            tipo: 'condicional',
            texto:
              '[Têxtil] Já tiveram reprovação de lote por encolhimento, fixação de cor ou cura incompleta?',
          },
          {
            id: 'V-T5',
            bloco: 'vertical_textil',
            tipo: 'condicional',
            texto: '[Têxtil] Como validam a uniformidade térmica dentro do equipamento?',
          },
          {
            id: 'S1',
            bloco: 'sinais_verdes',
            tipo: 'sinal',
            texto: 'Cliente já teve perda documentada relacionada a temperatura.',
          },
          {
            id: 'S2',
            bloco: 'sinais_verdes',
            tipo: 'sinal',
            texto: 'Auditoria, certificação ou inspeção prevista em curto prazo.',
          },
          {
            id: 'S3',
            bloco: 'sinais_verdes',
            tipo: 'sinal',
            texto: 'Não consegue provar conformidade térmica quando solicitado.',
          },
          {
            id: 'S4',
            bloco: 'sinais_verdes',
            tipo: 'sinal',
            texto: 'Usa sensor que não cobre o ponto crítico do processo.',
          },
          {
            id: 'R1',
            bloco: 'sinais_vermelhos',
            tipo: 'sinal',
            texto:
              'Quer apenas preço de etiqueta, sem discussão de processo. (desqualifica — RN-1.6)',
          },
          {
            id: 'R2',
            bloco: 'sinais_vermelhos',
            tipo: 'sinal',
            texto: 'Não tem processo térmico definido ou documentado. (desqualifica — RN-1.6)',
          },
          {
            id: 'R3',
            bloco: 'sinais_vermelhos',
            tipo: 'sinal',
            texto: 'Não tem responsável por qualidade identificado. (desqualifica — RN-1.6)',
          },
          {
            id: 'R4',
            bloco: 'sinais_vermelhos',
            tipo: 'sinal',
            texto: 'Busca solução sem aceitar fazer o diagnóstico. (desqualifica — RN-1.6)',
          },
        ],
      },
    ]

    for (const t of templates) {
      const r = new Record(col)
      r.set('familia', t.familia)
      r.set('tipo', t.tipo)
      r.set('titulo', t.titulo)
      r.set('produtos_cobertos', t.produtos_cobertos)
      r.set('perguntas_json', t.perguntas_json)
      r.set('blocos_comuns', t.blocos_comuns)
      r.set('fonte', t.fonte)
      r.set('ativo', true)
      app.save(r)
    }
  },
  (app) => {},
)
