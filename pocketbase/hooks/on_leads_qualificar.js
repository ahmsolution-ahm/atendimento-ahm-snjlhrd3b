// F1-T07 — SPEC 1.3: hook de qualificação — valida o processamento vindo do frontend.
// O motor de regras roda no frontend (src/lib/qualificacao.ts) e envia o resultado;
// este hook garante a auditoria: resultado e pendências sempre gravados juntos,
// qualificado_em/por preenchidos quando o status vira qualificado.
onRecordUpdate((e) => {
  const r = e.record
  const status = r.getString('status')
  const resultado = r.getString('qualificacao_resultado')

  // se o status é um estado de qualificação, exige justificativa (auditável)
  const estadosQualificacao = ['qualificado', 'fora do recorte', 'transbordo']
  if (estadosQualificacao.includes(status) && resultado === '') {
    throw new BadRequestError(
      'Qualificação sem justificativa não é permitida (SPEC 1.3): o resultado precisa ser auditável.',
    )
  }

  // auditoria de quem qualificou
  if (status === 'qualificado') {
    if (r.getString('qualificado_em') === '') {
      r.set('qualificado_em', new Date().toISOString().replace('T', ' ').replace('Z', 'Z'))
      r.set('qualificado_por', e.auth?.id || r.getString('responsavel'))
    }
  }
  e.next()
}, 'leads')
