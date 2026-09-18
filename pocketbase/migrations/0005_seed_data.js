migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const ticketsCol = app.findCollectionByNameOrId('tickets')
    const atendimentosCol = app.findCollectionByNameOrId('atendimentos')
    const comentariosCol = app.findCollectionByNameOrId('comentarios')
    const logsCol = app.findCollectionByNameOrId('logs_tickets')

    // Obter ou criar usuário admin/afonso
    let userAfonso
    try {
      userAfonso = app.findAuthRecordByEmail('_pb_users_auth_', 'afonso.moreira@ahmsolution.com')
    } catch (_) {
      userAfonso = new Record(users)
      userAfonso.setEmail('afonso.moreira@ahmsolution.com')
      userAfonso.setPassword('Skip@Pass')
      userAfonso.setVerified(true)
      userAfonso.set('name', 'Afonso Moreira')
      app.save(userAfonso)
    }

    // Usuários comerciais adicionais para o time
    const additionalUsers = [
      { email: 'beatriz.silva@ahmsolution.com', name: 'Beatriz Silva' },
      { email: 'carlos.mendes@ahmsolution.com', name: 'Carlos Mendes' },
      { email: 'mariana.costa@ahmsolution.com', name: 'Mariana Costa' },
    ]

    const userMap = { 'Afonso Moreira': userAfonso.id }

    for (let i = 0; i < additionalUsers.length; i++) {
      const u = additionalUsers[i]
      try {
        const existing = app.findAuthRecordByEmail('_pb_users_auth_', u.email)
        userMap[u.name] = existing.id
      } catch (_) {
        const rec = new Record(users)
        rec.setEmail(u.email)
        rec.setPassword('Skip@Pass')
        rec.setVerified(true)
        rec.set('name', u.name)
        app.save(rec)
        userMap[u.name] = rec.id
      }
    }

    // Idempotência para os tickets
    const seedTickets = [
      {
        ticket_id: 'AHM-2024-001',
        assunto: 'Proposta Comercial - Cargas e Fretes Especiais SP-PR',
        cliente: 'Logística TransVale Ltda',
        descricao:
          'Cliente solicita renegociação da tabela de fretes fracionados para o corredor rodoviário São Paulo x Curitiba, com volume mensal previsto de 45 toneladas.',
        status: 'Em andamento',
        prioridade: 'Alta',
        canal: 'Email',
        responsavelName: 'Afonso Moreira',
      },
      {
        ticket_id: 'AHM-2024-002',
        assunto: 'Divergência de Cubagem e Pesagem na NF-e 49201',
        cliente: 'Indústrias MetalSul S/A',
        descricao:
          'Divergência identificada no recebimento no terminal de Campinas. A carga constava com 3,2t aferidas contra 2,8t na nota fiscal eletrônica. Necessário retificação fiscal.',
        status: 'Aberto',
        prioridade: 'Urgente',
        canal: 'WhatsApp',
        responsavelName: 'Beatriz Silva',
      },
      {
        ticket_id: 'AHM-2024-003',
        assunto: 'Cotação de Armazenagem Climatizada para 2025',
        cliente: 'FarmaBio Distribuidora',
        descricao:
          'Necessidade de 120 posições-palete em galpão climatizado (15°C a 25°C) no hub logístico de Cajamar. Requer licença Anvisa para cosméticos e insumos.',
        status: 'Em andamento',
        prioridade: 'Média',
        canal: 'Telefone',
        responsavelName: 'Carlos Mendes',
      },
      {
        ticket_id: 'AHM-2024-004',
        assunto: 'Solicitação de Rastreamento Avançado de Frota Dedicada',
        cliente: 'EletroMax Brasil Comércio',
        descricao:
          'Integração via API webhook para telemetria de 8 carretas dedicadas. Time de TI do cliente aguarda documentação de autenticação.',
        status: 'Resolvido',
        prioridade: 'Média',
        canal: 'Chat',
        responsavelName: 'Mariana Costa',
      },
      {
        ticket_id: 'AHM-2024-005',
        assunto: 'Atraso na Entrega - Pedido #88412 Rota Sul',
        cliente: 'AgroFertil Cooperativa',
        descricao:
          'Bloqueio na rodovia BR-376 causou atraso de 14h na entrega de insumos agrícolas em Maringá/PR. Cliente acionou SLA comercial.',
        status: 'Fechado',
        prioridade: 'Alta',
        canal: 'Telefone',
        responsavelName: 'Afonso Moreira',
      },
      {
        ticket_id: 'AHM-2024-006',
        assunto: 'Renovação de Contrato Anual de Distribuição Urbana',
        cliente: 'Rede Farma Popular',
        descricao:
          'Contrato vigente vence em 45 dias. Cliente deseja manter frota 100% de veículos elétricos/VUCs na Grande São Paulo com reajuste IPCA.',
        status: 'Em andamento',
        prioridade: 'Alta',
        canal: 'Email',
        responsavelName: 'Beatriz Silva',
      },
      {
        ticket_id: 'AHM-2024-007',
        assunto: 'Dúvida Operacional sobre Paletização PBR1',
        cliente: 'NutriTech Alimentos',
        descricao:
          'Questionamento sobre as especificações de amarração com filme stretch e limite de altura (máximo 1,80m com pallet) para recebimento no CD.',
        status: 'Resolvido',
        prioridade: 'Baixa',
        canal: 'Email',
        responsavelName: 'Carlos Mendes',
      },
      {
        ticket_id: 'AHM-2024-008',
        assunto: 'Acionamento de Seguro de Carga Avariada Lote 129',
        cliente: 'Cerâmicas Revest S/A',
        descricao:
          'Laudo pericial acusou 4 paletes com quebra por tombamento lateral. Acionar a seguradora Allianz com apólice RCTR-C e boletim de ocorrência.',
        status: 'Aberto',
        prioridade: 'Urgente',
        canal: 'WhatsApp',
        responsavelName: 'Afonso Moreira',
      },
    ]

    const ticketRecords = {}

    for (let i = 0; i < seedTickets.length; i++) {
      const item = seedTickets[i]
      let tRec
      try {
        tRec = app.findFirstRecordByData('tickets', 'ticket_id', item.ticket_id)
      } catch (_) {
        tRec = new Record(ticketsCol)
        tRec.set('ticket_id', item.ticket_id)
        tRec.set('assunto', item.assunto)
        tRec.set('cliente', item.cliente)
        tRec.set('descricao', item.descricao)
        tRec.set('status', item.status)
        tRec.set('prioridade', item.prioridade)
        tRec.set('canal', item.canal)
        const respId = userMap[item.responsavelName] || userAfonso.id
        tRec.set('responsavel', respId)
        tRec.set('created_by', userAfonso.id)
        app.save(tRec)

        // Log inicial de criação
        const log = new Record(logsCol)
        log.set('ticket', tRec.id)
        log.set('acao', 'Ticket criado')
        log.set('usuario', userAfonso.id)
        log.set('detalhes', 'Ticket registrado no portal AHM Solution via ' + item.canal)
        app.save(log)
      }
      ticketRecords[item.ticket_id] = tRec
    }

    // Seed de 5 atendimentos
    const now = new Date()
    const d1 =
      new Date(now.getTime() - 2 * 3600 * 1000).toISOString().replace('T', ' ').substring(0, 19) +
      'Z'
    const d2 =
      new Date(now.getTime() - 4 * 3600 * 1000).toISOString().replace('T', ' ').substring(0, 19) +
      'Z'
    const d3 =
      new Date(now.getTime() - 24 * 3600 * 1000).toISOString().replace('T', ' ').substring(0, 19) +
      'Z'
    const d4 =
      new Date(now.getTime() - 1 * 3600 * 1000).toISOString().replace('T', ' ').substring(0, 19) +
      'Z'
    const d5Start =
      new Date(now.getTime() - 48 * 3600 * 1000).toISOString().replace('T', ' ').substring(0, 19) +
      'Z'
    const d5End =
      new Date(now.getTime() - 40 * 3600 * 1000).toISOString().replace('T', ' ').substring(0, 19) +
      'Z'

    const seedAtendimentos = [
      {
        ticketKey: 'AHM-2024-001',
        usuarioName: 'Afonso Moreira',
        status: 'Ativo',
        canal: 'Email',
        inicio: d1,
      },
      {
        ticketKey: 'AHM-2024-002',
        usuarioName: 'Beatriz Silva',
        status: 'Ativo',
        canal: 'WhatsApp',
        inicio: d2,
      },
      {
        ticketKey: 'AHM-2024-003',
        usuarioName: 'Carlos Mendes',
        status: 'Aguardando resposta',
        canal: 'Telefone',
        inicio: d3,
      },
      {
        ticketKey: 'AHM-2024-006',
        usuarioName: 'Beatriz Silva',
        status: 'Ativo',
        canal: 'Email',
        inicio: d4,
      },
      {
        ticketKey: 'AHM-2024-005',
        usuarioName: 'Afonso Moreira',
        status: 'Encerrado',
        canal: 'Telefone',
        inicio: d5Start,
        fim: d5End,
      },
    ]

    for (let i = 0; i < seedAtendimentos.length; i++) {
      const at = seedAtendimentos[i]
      const tRec = ticketRecords[at.ticketKey]
      if (!tRec) continue

      const uId = userMap[at.usuarioName] || userAfonso.id
      try {
        app.findFirstRecordByData('atendimentos', 'ticket', tRec.id)
      } catch (_) {
        const atRec = new Record(atendimentosCol)
        atRec.set('ticket', tRec.id)
        atRec.set('usuario', uId)
        atRec.set('status', at.status)
        atRec.set('canal', at.canal)
        atRec.set('inicio_atendimento', at.inicio)
        if (at.fim) {
          atRec.set('fim_atendimento', at.fim)
        }
        app.save(atRec)
      }
    }

    // Seed de 6 comentários distribuídos
    const seedComentarios = [
      {
        ticketKey: 'AHM-2024-001',
        autorName: 'Afonso Moreira',
        conteudo:
          'Enviamos a simulação de fretes com desconto de 7,5% considerando o volume prometido de 45t/mês. Aguardando validação da diretoria da TransVale.',
      },
      {
        ticketKey: 'AHM-2024-001',
        autorName: 'Beatriz Silva',
        conteudo:
          'Operação de cross-docking em São José dos Pinhais alinhada para atender a rota sem gargalos.',
      },
      {
        ticketKey: 'AHM-2024-002',
        autorName: 'Beatriz Silva',
        conteudo:
          'Ticket de pesagem emitido pela balança de Campinas foi anexado ao processo. Cliente informou que vai emitir nota complementar ainda hoje.',
      },
      {
        ticketKey: 'AHM-2024-003',
        autorName: 'Carlos Mendes',
        conteudo:
          'Vistoria técnica das câmaras frias agendada para sexta-feira às 14h com o responsável de qualidade da FarmaBio.',
      },
      {
        ticketKey: 'AHM-2024-006',
        autorName: 'Beatriz Silva',
        conteudo:
          'Minuta contratual de renovação revisada pelo jurídico da AHM Solution com inclusão dos 4 novos VUCs 100% elétricos.',
      },
      {
        ticketKey: 'AHM-2024-008',
        autorName: 'Afonso Moreira',
        conteudo:
          'Fotos da descarga e laudo do perito anexados ao sinistro. Aguardando retorno da reguladora Allianz em até 48 horas úteis.',
      },
    ]

    for (let i = 0; i < seedComentarios.length; i++) {
      const c = seedComentarios[i]
      const tRec = ticketRecords[c.ticketKey]
      if (!tRec) continue
      const uId = userMap[c.autorName] || userAfonso.id

      try {
        app.findFirstRecordByData('comentarios', 'conteudo', c.conteudo)
      } catch (_) {
        const cRec = new Record(comentariosCol)
        cRec.set('ticket', tRec.id)
        cRec.set('autor', uId)
        cRec.set('conteudo', c.conteudo)
        app.save(cRec)
      }
    }
  },
  (app) => {},
)
