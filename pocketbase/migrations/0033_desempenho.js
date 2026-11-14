// Fase 2 · Bloco C (F2-T13) — Desempenho e Minha mesa.
// 1) Coleção motivos_perda: lista fixa de motivos de perda (a mesma do Pipedrive do owner,
//    conforme briefing 06_notas/briefing-f2-bloco-c-desempenho.md). É uma coleção (e não um
//    select) para o administrador poder ativar/desativar motivos sem nova migration.
//    "Outro (especificar)" entra INATIVO e com detalhe obrigatório: a decisão é do owner
//    (recomendação do Bart: ativar). Ativo = aparece para escolha no fechamento.
// 2) Coleção configuracoes: parâmetros simples do administrador (chave → número).
//    Semente: meta de negócios criados por mês = 20 (número do owner).
// 3) oportunidades.responsavel (→ users): dono da oportunidade. Backfill a partir do
//    responsável do lead; lead sem responsável → fica vazio ("sem responsável", estado honesto).
// 4) oportunidades.motivo_perda e oportunidade_fechamentos.motivo_perda (→ motivos_perda).
//    Backfill: as perdas existentes NÃO recebem classificação retroativa — o texto antigo
//    continua em resultado_motivo (agora "observação") e o motivo da lista fica vazio.
// Regras das coleções novas: padrão da Fase 1 (autenticado); a escrita só por administrador
// é garantida no hook permissoes_papel.js (resposta 403 com mensagem clara).
// Down: remove campos e coleções.
migrate(
  (app) => {
    const AUTH = "@request.auth.id != ''"

    const motivos = new Collection({
      name: 'motivos_perda',
      type: 'base',
      listRule: AUTH,
      viewRule: AUTH,
      createRule: AUTH,
      updateRule: AUTH,
      deleteRule: AUTH,
      fields: [
        { name: 'nome', type: 'text', required: true, max: 120 },
        { name: 'grupo', type: 'text', max: 60 },
        { name: 'ordem', type: 'number', onlyInt: true },
        { name: 'ativo', type: 'bool' },
        { name: 'exige_detalhe', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_motivos_perda_nome ON motivos_perda (nome)'],
    })
    app.save(motivos)

    const lista = [
      ['Alto volume', 'Desistência'],
      ['Alto volume', 'Sem retorno do cliente'],
      ['Alto volume', 'Curiosidade'],
      ['Alto volume', 'Duplicidade'],
      ['Alto volume', 'Não consegui contato'],
      ['Alto volume', 'Qualificação inadequada MKT'],
      ['Técnicos e comerciais', 'Inviabilidade técnica'],
      ['Técnicos e comerciais', 'Preço'],
      ['Técnicos e comerciais', 'Optou por outra solução'],
      ['Técnicos e comerciais', 'Suspenso pelo cliente'],
      ['Técnicos e comerciais', 'Cliente do cliente'],
      ['Técnicos e comerciais', 'Empresa não está no momento'],
      ['Técnicos e comerciais', 'Projeto não aprovado'],
      ['Técnicos e comerciais', 'Características técnicas'],
      ['Técnicos e comerciais', 'Oferta de fornecimento'],
      ['Técnicos e comerciais', 'Prazo de entrega'],
      ['Técnicos e comerciais', 'Aprovação financeira'],
      ['Técnicos e comerciais', 'Barreira tecnológica'],
      ['Menor volume', 'Decisão gerencial'],
      ['Menor volume', 'Política de priorização'],
      ['Menor volume', 'Solução do concorrente'],
      ['Menor volume', 'Dados de contato incorretos'],
      ['Menor volume', 'Percepção de valor agregado'],
      ['Menor volume', 'Prazo de implantação'],
      ['Menor volume', 'Relacionamento com fornecedor atual'],
    ]
    let ordem = 1
    for (const [grupo, nome] of lista) {
      const r = new Record(motivos)
      r.set('nome', nome)
      r.set('grupo', grupo)
      r.set('ordem', ordem++)
      r.set('ativo', true)
      r.set('exige_detalhe', false)
      app.save(r)
    }
    const outro = new Record(motivos)
    outro.set('nome', 'Outro (especificar)')
    outro.set('grupo', 'Outro')
    outro.set('ordem', 999)
    outro.set('ativo', false)
    outro.set('exige_detalhe', true)
    app.save(outro)

    const config = new Collection({
      name: 'configuracoes',
      type: 'base',
      listRule: AUTH,
      viewRule: AUTH,
      createRule: AUTH,
      updateRule: AUTH,
      deleteRule: AUTH,
      fields: [
        { name: 'chave', type: 'text', required: true, max: 80 },
        { name: 'valor_numero', type: 'number' },
        { name: 'descricao', type: 'text', max: 255 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_configuracoes_chave ON configuracoes (chave)'],
    })
    app.save(config)
    const meta = new Record(config)
    meta.set('chave', 'meta_negocios_criados_mes')
    meta.set('valor_numero', 20)
    meta.set('descricao', 'Meta do time: negócios (oportunidades) criados por mês.')
    app.save(meta)

    const users = app.findCollectionByNameOrId('users')
    const ops = app.findCollectionByNameOrId('oportunidades')
    if (!ops.fields.getByName('responsavel')) {
      ops.fields.add(
        new RelationField({
          name: 'responsavel',
          collectionId: users.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }
    if (!ops.fields.getByName('motivo_perda')) {
      ops.fields.add(
        new RelationField({
          name: 'motivo_perda',
          collectionId: motivos.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }
    ops.addIndex('idx_oportunidades_responsavel', false, 'responsavel', '')
    app.save(ops)

    const fech = app.findCollectionByNameOrId('oportunidade_fechamentos')
    if (!fech.fields.getByName('motivo_perda')) {
      fech.fields.add(
        new RelationField({
          name: 'motivo_perda',
          collectionId: motivos.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      app.save(fech)
    }

    // backfill do responsável a partir do lead (sem inventar dono quando o lead não tem)
    for (const op of app.findAllRecords('oportunidades')) {
      if (op.getString('responsavel')) continue
      try {
        const lead = app.findRecordById('leads', op.getString('lead'))
        const resp = lead.getString('responsavel')
        if (resp) {
          op.set('responsavel', resp)
          app.saveNoValidate(op)
        }
      } catch (_) {
        /* lead removido: oportunidade segue sem responsável */
      }
    }
  },
  (app) => {
    const ops = app.findCollectionByNameOrId('oportunidades')
    ops.removeIndex('idx_oportunidades_responsavel')
    ops.fields.removeByName('responsavel')
    ops.fields.removeByName('motivo_perda')
    app.save(ops)
    const fech = app.findCollectionByNameOrId('oportunidade_fechamentos')
    fech.fields.removeByName('motivo_perda')
    app.save(fech)
    for (const nome of ['configuracoes', 'motivos_perda']) {
      try {
        app.delete(app.findCollectionByNameOrId(nome))
      } catch (_) {}
    }
  },
)
