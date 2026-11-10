// F1-T08 — SPEC 1.3: reprocessamento auditável.
// IMPORTANTE (lição v0.0.20-0.0.23): o hook JS do PocketBase NÃO consegue gravar campo json
// de forma confiável — r.set com array JS dá validation_invalid_json; com string JSON grava
// charcodes ([0,91,93]). O histórico é montado no FRONTEND (leadsService.gravarQualificacao
// lê o histórico atual, anexa a entrada e envia o array no PATCH — a API aceita array direto).
// Este hook fica como guard: nada a fazer hoje, mas mantém o ponto de extensão documentado.
onRecordUpdate((e) => {
  // histórico é gravado pelo frontend (ver comentário acima)
  e.next()
}, 'leads')
