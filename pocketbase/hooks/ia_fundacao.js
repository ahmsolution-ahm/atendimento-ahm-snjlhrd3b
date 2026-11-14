// IA de vendas · F0.1–F0.5 — permissões, validações e auditoria da fundação.
// Obs.: lógica inteira dentro de cada callback (o JSVM não enxerga funções de topo nem aceita
// require de arquivo local).

// 1) Configuração da IA: criar/editar/excluir só administrador (403 com mensagem clara)
onRecordCreateRequest(
  (e) => {
    const admin =
      e.hasSuperuserAuth() ||
      (!!e.auth && e.auth.collection().name === 'users' && e.auth.getString('papel') === 'admin')
    if (!admin)
      throw new ForbiddenError('Esta configuração só pode ser alterada por um administrador.')
    if (e.collection.name === 'base_conhecimento' && e.auth) e.record.set('criado_por', e.auth.id)
    return e.next()
  },
  'base_conhecimento',
  'regras_roteamento',
  'janelas_executivo',
)

onRecordUpdateRequest(
  (e) => {
    const admin =
      e.hasSuperuserAuth() ||
      (!!e.auth && e.auth.collection().name === 'users' && e.auth.getString('papel') === 'admin')
    if (!admin)
      throw new ForbiddenError('Esta configuração só pode ser alterada por um administrador.')
    return e.next()
  },
  'base_conhecimento',
  'regras_roteamento',
  'janelas_executivo',
)

onRecordDeleteRequest(
  (e) => {
    const admin =
      e.hasSuperuserAuth() ||
      (!!e.auth && e.auth.collection().name === 'users' && e.auth.getString('papel') === 'admin')
    if (!admin)
      throw new ForbiddenError('Esta configuração só pode ser alterada por um administrador.')
    return e.next()
  },
  'base_conhecimento',
  'regras_roteamento',
  'janelas_executivo',
)

// 2) Leitura restrita ao administrador: base de conhecimento e fila de envios da IA
onRecordsListRequest(
  (e) => {
    const admin =
      e.hasSuperuserAuth() ||
      (!!e.auth && e.auth.collection().name === 'users' && e.auth.getString('papel') === 'admin')
    if (!admin) {
      throw new ForbiddenError(
        e.collection.name === 'ia_envios'
          ? 'A fila de envios da IA é restrita ao administrador.'
          : 'A base de conhecimento da IA é restrita ao administrador.',
      )
    }
    return e.next()
  },
  'base_conhecimento',
  'ia_envios',
)

// 3) Auditoria de envios: gravada SÓ pelo servidor (a IA grava com $app.save, que não passa
//    por estes hooks de requisição). Qualquer requisição de escrita — inclusive de admin — é
//    recusada, para o histórico não poder ser forjado nem apagado.
onRecordCreateRequest((e) => {
  const viaRequisicao = !!e.collection
  if (viaRequisicao)
    throw new ForbiddenError('Os registros de envio da IA são gravados apenas pelo sistema.')
  return e.next()
}, 'ia_envios')
onRecordUpdateRequest((e) => {
  const viaRequisicao = !!e.collection
  if (viaRequisicao)
    throw new ForbiddenError('Os registros de envio da IA são gravados apenas pelo sistema.')
  return e.next()
}, 'ia_envios')
onRecordDeleteRequest((e) => {
  const viaRequisicao = !!e.collection
  if (viaRequisicao)
    throw new ForbiddenError('Os registros de envio da IA são gravados apenas pelo sistema.')
  return e.next()
}, 'ia_envios')

// 4) Validações (model hooks — qualquer origem)
onRecordCreate((e) => {
  if (e.record.getString('fonte').trim() === '') {
    throw new BadRequestError(
      'Informe a fonte deste conhecimento: sem fonte, a IA não pode usá-lo.',
    )
  }
  return e.next()
}, 'base_conhecimento')
onRecordUpdate((e) => {
  if (e.record.getString('fonte').trim() === '') {
    throw new BadRequestError(
      'Informe a fonte deste conhecimento: sem fonte, a IA não pode usá-lo.',
    )
  }
  return e.next()
}, 'base_conhecimento')

onRecordCreate((e) => {
  const r = e.record
  if (r.getString('vendedor')) r.set('aguardando_cadastro', false)
  if (r.getBool('ativo') && !r.getString('vendedor')) {
    throw new BadRequestError('Para ativar a regra de roteamento, escolha o vendedor.')
  }
  return e.next()
}, 'regras_roteamento')
onRecordUpdate((e) => {
  const r = e.record
  if (r.getString('vendedor')) r.set('aguardando_cadastro', false)
  if (r.getBool('ativo') && !r.getString('vendedor')) {
    throw new BadRequestError('Para ativar a regra de roteamento, escolha o vendedor.')
  }
  return e.next()
}, 'regras_roteamento')

onRecordCreate((e) => {
  const r = e.record
  const d = r.getInt('dia_semana')
  const mi = (s) => {
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s || '')
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : -1
  }
  if (d < 0 || d > 6) throw new BadRequestError('Escolha um dia da semana válido para a janela.')
  if (
    mi(r.getString('inicio')) < 0 ||
    mi(r.getString('fim')) < 0 ||
    mi(r.getString('inicio')) >= mi(r.getString('fim'))
  ) {
    throw new BadRequestError(
      'O horário de início da janela precisa ser anterior ao horário de fim.',
    )
  }
  return e.next()
}, 'janelas_executivo')
onRecordUpdate((e) => {
  const r = e.record
  const d = r.getInt('dia_semana')
  const mi = (s) => {
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s || '')
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : -1
  }
  if (d < 0 || d > 6) throw new BadRequestError('Escolha um dia da semana válido para a janela.')
  if (
    mi(r.getString('inicio')) < 0 ||
    mi(r.getString('fim')) < 0 ||
    mi(r.getString('inicio')) >= mi(r.getString('fim'))
  ) {
    throw new BadRequestError(
      'O horário de início da janela precisa ser anterior ao horário de fim.',
    )
  }
  return e.next()
}, 'janelas_executivo')

// modo de operação da IA: só os três valores previstos
onRecordUpdate((e) => {
  const r = e.record
  if (
    r.getString('chave') === 'ia_modo' &&
    ['desligada', 'rascunho', 'automatica'].indexOf(r.getString('valor_texto')) < 0
  ) {
    throw new BadRequestError('Modo de operação inválido. Use desligada, rascunho ou automática.')
  }
  if (r.getString('chave') !== r.original().getString('chave')) {
    throw new BadRequestError('A chave de uma configuração não pode ser alterada.')
  }
  return e.next()
}, 'configuracoes')

// 5) Prévia dos horários que seriam oferecidos (admin): janelas ∩ agenda real.
//    Enquanto a agenda do Outlook não está conectada (F0.6), a resposta é SEMPRE vazia com
//    erro "agenda_indisponivel" — nenhum horário inventado.
//    GÊMEA de src/lib/horarios.ts (mesma lógica, coberta por testes) — mudar nos dois lugares.
routerAdd(
  'GET',
  '/backend/v1/ia/horarios-previa',
  (e) => {
    const admin =
      e.hasSuperuserAuth() ||
      (!!e.auth && e.auth.collection().name === 'users' && e.auth.getString('papel') === 'admin')
    if (!admin) throw new ForbiddenError('A prévia de horários é restrita ao administrador.')
    const vendedor = e.request.url.query().get('vendedor') || ''
    if (!/^[a-z0-9]{15}$/.test(vendedor)) throw new BadRequestError('Escolha o executivo.')

    const lista = $app.findRecordsByFilter(
      'janelas_executivo',
      'vendedor = {:v} && ativo = true',
      '',
      100,
      0,
      {
        v: vendedor,
      },
    )
    const janelas = []
    for (let i = 0; i < lista.length; i++) {
      janelas.push({
        dia_semana: lista[i].getInt('dia_semana'),
        inicio: lista[i].getString('inicio'),
        fim: lista[i].getString('fim'),
        ativo: true,
      })
    }
    // agenda real: ainda não conectada (F0.6 — Microsoft 365)
    const agenda = null

    const horariosDisponiveis = (o) => {
      const minutos = (hhmm) => {
        const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(hhmm || ''))
        return m ? Number(m[1]) * 60 + Number(m[2]) : null
      }
      if (!Array.isArray(o.agenda)) return { horarios: [], erro: 'agenda_indisponivel' }
      const ocupados = []
      for (let i = 0; i < o.agenda.length; i++) {
        const a = Date.parse(o.agenda[i] && o.agenda[i].inicio)
        const f = Date.parse(o.agenda[i] && o.agenda[i].fim)
        if (!isFinite(a) || !isFinite(f) || f <= a) return { horarios: [], erro: 'agenda_invalida' }
        ocupados.push([a, f])
      }
      const js = (o.janelas || []).filter(
        (j) =>
          j &&
          j.ativo !== false &&
          j.dia_semana >= 0 &&
          j.dia_semana <= 6 &&
          minutos(j.inicio) !== null &&
          minutos(j.fim) !== null &&
          minutos(j.inicio) < minutos(j.fim),
      )
      if (js.length === 0) return { horarios: [], erro: 'sem_janelas' }
      const agora = o.agoraMs || Date.now()
      const fuso = typeof o.fusoMin === 'number' ? o.fusoMin : -180
      const duracao = o.duracaoMin || 30
      const maximo = o.maximo || 3
      const dias = o.dias || 10
      const limite =
        agora + (typeof o.antecedenciaHoras === 'number' ? o.antecedenciaHoras : 24) * 3600e3
      const horarios = []
      for (let d = 0; d <= dias && horarios.length < maximo; d++) {
        const local = new Date(agora + fuso * 60e3 + d * 86400e3)
        const doDia = js
          .filter((j) => j.dia_semana === local.getUTCDay())
          .sort((a, b) => minutos(a.inicio) - minutos(b.inicio))
        let achou = false
        for (let k = 0; k < doDia.length && !achou; k++) {
          const ini = minutos(doDia[k].inicio)
          const fim = minutos(doDia[k].fim)
          for (let t = ini; t + duracao <= fim; t += 30) {
            const inicioMs =
              Date.UTC(
                local.getUTCFullYear(),
                local.getUTCMonth(),
                local.getUTCDate(),
                Math.floor(t / 60),
                t % 60,
              ) -
              fuso * 60e3
            const fimMs = inicioMs + duracao * 60e3
            if (inicioMs < limite) continue
            let livre = true
            for (let z = 0; z < ocupados.length; z++) {
              if (inicioMs < ocupados[z][1] && fimMs > ocupados[z][0]) {
                livre = false
                break
              }
            }
            if (!livre) continue
            horarios.push({
              inicio: new Date(inicioMs).toISOString(),
              fim: new Date(fimMs).toISOString(),
            })
            achou = true
            break
          }
        }
      }
      return { horarios: horarios, erro: horarios.length > 0 ? null : 'sem_horario_livre' }
    }

    const r = horariosDisponiveis({ janelas: janelas, agenda: agenda })
    const mensagens = {
      agenda_indisponivel:
        'A agenda do Outlook ainda não está conectada. Nenhum horário é oferecido ao cliente até a conexão existir.',
      agenda_invalida: 'A agenda do Outlook retornou dados inválidos. Nenhum horário é oferecido.',
      sem_janelas: 'Este executivo não tem janelas de atendimento ativas.',
      sem_horario_livre: 'Não há horário livre nas janelas dos próximos dias.',
    }
    return e.json(200, {
      janelas: janelas.length,
      horarios: r.horarios,
      erro: r.erro,
      mensagem: r.erro ? mensagens[r.erro] : '',
    })
  },
  $apis.requireAuth(),
)
