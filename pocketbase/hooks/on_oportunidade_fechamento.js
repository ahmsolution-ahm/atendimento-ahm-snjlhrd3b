// Fase 2 · Bloco 2 · Item 3 (F2-T06) — fechamento ganho/perda com motivo auditável.
// Validação (model hook):
//   - fechar (resultado vazio → ganha/perdida) exige motivo e os campos de fechamento:
//     ambiente de fechamento e valor estimado > 0 (validação pendente do Bloco 1);
//   - trocar o resultado direto (ganha ↔ perdida) não é permitido: reabra antes;
//   - reabrir (ganha/perdida → vazio) exige justificativa nova;
//   - oportunidade fechada não muda de etapa.
// Auditoria: request hook grava quem (resultado_por / fechado_por); after-success registra
// cada fechamento e reabertura em oportunidade_fechamentos — nada é apagado.
onRecordUpdate((e) => {
  const r = e.record
  const o = r.original()
  const res = r.getString('resultado')
  const resAnt = o.getString('resultado')

  if (res !== resAnt) {
    if (res !== '') {
      if (resAnt !== '') {
        throw new BadRequestError(
          'Esta oportunidade já está fechada. Reabra-a antes de registrar outro resultado.',
        )
      }
      // Bloco C: ganho exige motivo em texto; perda exige o motivo da LISTA (motivos_perda,
      // ativo) — o texto vira observação, obrigatória só quando o motivo exige detalhe.
      if (res === 'ganha') {
        if (r.getString('resultado_motivo').trim() === '') {
          throw new BadRequestError('Informe o motivo do ganho.')
        }
      } else {
        const motivoId = r.getString('motivo_perda')
        if (motivoId === '') {
          throw new BadRequestError('Escolha o motivo da perda na lista.')
        }
        let motivo = null
        try {
          motivo = $app.findRecordById('motivos_perda', motivoId)
        } catch (_) {
          motivo = null
        }
        if (!motivo || !motivo.getBool('ativo')) {
          throw new BadRequestError(
            'O motivo de perda escolhido não está disponível. Escolha outro da lista.',
          )
        }
        if (motivo.getBool('exige_detalhe') && r.getString('resultado_motivo').trim() === '') {
          throw new BadRequestError('Para este motivo de perda, descreva o detalhe na observação.')
        }
      }
      const faltando = []
      if (r.getString('ambiente_fechamento') === '') faltando.push('o ambiente de fechamento')
      if (!(r.getFloat('valor_estimado') > 0)) faltando.push('o valor estimado')
      if (faltando.length > 0) {
        throw new BadRequestError(
          'Para registrar o resultado, preencha ' + faltando.join(' e ') + ' na seção Fechamento.',
        )
      }
      r.set('fechado_em', new Date().toISOString())
      r.set('reabertura_motivo', '')
    } else {
      const just = r.getString('reabertura_motivo').trim()
      if (just === '' || just === o.getString('reabertura_motivo').trim()) {
        throw new BadRequestError('Para reabrir a oportunidade, informe a justificativa.')
      }
      r.set('resultado_motivo', '')
      r.set('motivo_perda', '')
      r.set('concorrente', '')
      r.set('fechado_em', '')
      r.set('fechado_por', '')
    }
  } else if (res !== '' && r.getString('etapa_atual') !== o.getString('etapa_atual')) {
    throw new BadRequestError('Esta oportunidade está fechada. Reabra-a para mudar de etapa.')
  }
  return e.next()
}, 'oportunidades')

onRecordUpdateRequest((e) => {
  const r = e.record
  const res = r.getString('resultado')
  if (res !== r.original().getString('resultado')) {
    const autor = e.auth ? e.auth.id : ''
    r.set('resultado_por', autor)
    if (res !== '') r.set('fechado_por', autor)
  }
  return e.next()
}, 'oportunidades')

onRecordAfterUpdateSuccess((e) => {
  try {
    const r = e.record
    const o = r.original()
    const res = r.getString('resultado')
    const resAnt = o.getString('resultado')
    if (res !== resAnt) {
      const log = new Record($app.findCollectionByNameOrId('oportunidade_fechamentos'))
      log.set('oportunidade', r.id)
      if (res !== '') {
        log.set('acao', 'fechamento')
        log.set('resultado', res)
        let texto = r.getString('resultado_motivo').trim()
        const motivoId = r.getString('motivo_perda')
        if (res === 'perdida' && motivoId !== '') {
          let nome = ''
          try {
            nome = $app.findRecordById('motivos_perda', motivoId).getString('nome')
          } catch (_) {
            nome = ''
          }
          texto = nome ? (texto ? nome + ' — ' + texto : nome) : texto
          log.set('motivo_perda', motivoId)
        }
        log.set('motivo', texto || 'Sem observação')
        log.set('concorrente', r.getString('concorrente'))
      } else {
        log.set('acao', 'reabertura')
        log.set('resultado', resAnt)
        log.set('motivo', r.getString('reabertura_motivo'))
      }
      log.set('valor_estimado', r.getFloat('valor_estimado'))
      log.set('moeda', r.getString('moeda'))
      log.set('registrado_por', r.getString('resultado_por'))
      log.set('registrado_em', new Date().toISOString())
      $app.save(log)
    }
  } catch (err) {
    $app.logger().warn('Fechamento: histórico não registrado', { err: String(err) })
  } finally {
    e.next()
  }
}, 'oportunidades')
