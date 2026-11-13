// Fase 2 · Bloco 2 · Item 1 — proteção contra exclusão na base real (pedido do owner, 13/11).
// Contexto: em 13/11 um script de limpeza (com login de ADMINISTRADOR e filtro malformado)
// tentou apagar o lead real Aroldo; só não apagou porque ele tinha vínculos. Por isso a regra
// NÃO depende de papel: vale para qualquer origem, inclusive administrador e scripts.
//
// Regra: só é aceita a exclusão de registro de PROVA — o lead (ou o lead dono do registro)
// tem nome ou empresa começando com "PROVA" ou "DEMO". Registro real é recusado (403);
// um lead real sai de circulação por ARQUIVAMENTO (on_leads_arquivamento.js).
// Toda exclusão aceita é registrada em exclusoes_auditoria (quem, o quê, quando).
// Exclusões em cascata feitas pelo próprio banco (ex.: histórico da oportunidade apagada)
// não passam por aqui — elas só acontecem a partir de uma exclusão já autorizada.
// Obs.: lógica inteira dentro do callback (o JSVM não enxerga funções de topo).
onRecordDeleteRequest(
  (e) => {
    const r = e.record
    const col = r.collection().name

    let lead = null
    try {
      if (col === 'leads') {
        lead = r
      } else if (col === 'oportunidade_etapas') {
        const op = $app.findRecordById('oportunidades', r.getString('oportunidade'))
        lead = $app.findRecordById('leads', op.getString('lead'))
      } else if (col === 'etapa_checklist_respostas') {
        const h = $app.findRecordById('oportunidade_etapas', r.getString('historico'))
        const op = $app.findRecordById('oportunidades', h.getString('oportunidade'))
        lead = $app.findRecordById('leads', op.getString('lead'))
      } else {
        lead = $app.findRecordById('leads', r.getString('lead'))
      }
    } catch (_) {
      lead = null
    }

    // Bloco 3: marcador como PALAVRA INTEIRA — "PROVA …", "DEMO —" sim; empresas reais como
    // "Demolidora" ou "Provale" não (antes o prefixo solto as tornava apagáveis).
    const marcado = (s) => /^(PROVA|DEMO)(?![A-ZÀ-ÖØ-Þ])/.test((s || '').trim().toUpperCase())
    const prova = !!lead && (marcado(lead.getString('nome')) || marcado(lead.getString('empresa')))

    if (!prova) {
      throw new ForbiddenError(
        col === 'leads'
          ? 'Este lead não pode ser excluído por não ser um registro de prova. Para tirá-lo de circulação, use Arquivar.'
          : 'Este registro não pode ser excluído por não ser um registro de prova.',
      )
    }

    const rotulos = {
      leads: 'Lead',
      oportunidades: 'Oportunidade',
      transbordos: 'Transbordo',
      interacoes: 'Interação',
      oportunidade_etapas: 'Registro de etapa',
      etapa_checklist_respostas: 'Resposta de checklist',
    }
    const descricao = (rotulos[col] || col) + ' do lead "' + lead.getString('nome') + '"'
    const autorId = e.auth ? e.auth.id : ''
    // Bloco 3: usuário com papel admin também é registrado como administrador
    const tipo =
      e.hasSuperuserAuth() || (!!e.auth && e.auth.getString('papel') === 'admin')
        ? 'administrador'
        : 'usuário'

    e.next()

    // auditoria depois da exclusão confirmada
    try {
      const aud = new Record($app.findCollectionByNameOrId('exclusoes_auditoria'))
      aud.set('colecao', col)
      aud.set('registro_id', r.id)
      aud.set('descricao', descricao)
      aud.set('apagado_por', autorId)
      aud.set('apagado_por_tipo', tipo)
      aud.set('apagado_em', new Date().toISOString())
      $app.save(aud)
    } catch (err) {
      $app.logger().warn('Proteção: auditoria de exclusão não registrada', {
        col,
        id: r.id,
        err: String(err),
      })
    }
  },
  'leads',
  'oportunidades',
  'transbordos',
  'interacoes',
  'oportunidade_etapas',
  'etapa_checklist_respostas',
)
