// F2-T08 — pendência técnica da Fase 1: criação de leads em LOTE no servidor.
// POST /backend/v1/leads/lote  (somente usuário autenticado)
// Corpo: { leads: [ { nome, empresa, contato, telefone, origem, produto_interesse, dor,
//          urgencia, observacoes, area_interesse, pais, idioma, modelo_compra, status, incompleto } ] }
// - Até 500 leads por requisição; todos gravados numa única transação (um commit só — é o
//   que torna o lote rápido). Os hooks de validação do lead rodam normalmente em cada registro.
// - Um registro inválido NÃO derruba o lote: é devolvido em "falhas" com o índice e o motivo.
// - responsavel = usuário autenticado (não vem do cliente); status só "novo" ou "pendente".
// - A verificação de duplicados continua ANTES, no navegador (prévia da importação): este
//   endpoint recebe apenas os leads novos.
// Obs.: lógica inteira dentro do callback (o JSVM não enxerga funções de topo).
routerAdd(
  'POST',
  '/backend/v1/leads/lote',
  (e) => {
    const body = e.requestInfo().body || {}
    const lista = body.leads
    if (!Array.isArray(lista)) {
      throw new BadRequestError('Envie a lista de leads no campo "leads".')
    }
    if (lista.length > 500) {
      throw new BadRequestError('Envie no máximo 500 leads por requisição.')
    }
    const inicio = Date.now()
    const campos = [
      'nome',
      'empresa',
      'contato',
      'telefone',
      'origem',
      'produto_interesse',
      'dor',
      'urgencia',
      'observacoes',
      'area_interesse',
      'pais',
      'idioma',
      'modelo_compra',
    ]
    const col = $app.findCollectionByNameOrId('leads')
    const resultado = { criados: 0, falhas: [] }

    $app.runInTransaction((txApp) => {
      for (let i = 0; i < lista.length; i++) {
        const item = lista[i] || {}
        try {
          const rec = new Record(col)
          for (let c = 0; c < campos.length; c++) {
            const v = item[campos[c]]
            if (v !== undefined && v !== null) rec.set(campos[c], v)
          }
          rec.set('status', item.status === 'pendente' ? 'pendente' : 'novo')
          rec.set('incompleto', item.incompleto === true)
          rec.set('responsavel', e.auth.id)
          txApp.save(rec)
          resultado.criados++
        } catch (err) {
          resultado.falhas.push({
            indice: i,
            motivo: String((err && err.message) || err),
          })
        }
      }
    })

    return e.json(200, {
      criados: resultado.criados,
      falhas: resultado.falhas,
      ms: Date.now() - inicio,
    })
  },
  $apis.requireAuth(),
)
