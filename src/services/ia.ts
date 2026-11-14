import pb from '@/lib/pocketbase/client'

// IA de vendas · F0 — configuração (modo, roteamento, janelas, base de conhecimento) e fila de
// envios. Escritas só de administrador (o servidor recusa as demais com 403).

export type ModoIa = 'desligada' | 'rascunho' | 'automatica'

export interface ConhecimentoRecord {
  id: string
  tipo: 'produto' | 'metodologia' | 'caso' | 'pergunta_frequente' | 'material' | 'especialista'
  titulo: string
  conteudo: string
  produto?: string
  familia?: string
  fonte: string
  ativo?: boolean
  expand?: { produto?: { id: string; nome: string } }
}

export interface RegraRoteamentoRecord {
  id: string
  modelo_negocio: string
  vendedor?: string
  vendedor_previsto?: string
  ativo?: boolean
  aguardando_cadastro?: boolean
  observacao?: string
}

export interface JanelaRecord {
  id: string
  vendedor: string
  dia_semana: number
  inicio: string
  fim: string
  ativo?: boolean
}

export interface EnvioIaRecord {
  id: string
  lead?: string
  gatilho?: string
  destinatario?: string
  assunto?: string
  status: 'rascunho' | 'aprovado' | 'enviado' | 'falha' | 'descartado' | 'conflito'
  modo?: string
  erro?: string
  criado_em: string
  expand?: { lead?: { nome: string; empresa: string } }
}

export interface PreviaHorarios {
  janelas: number
  horarios: { inicio: string; fim: string }[]
  erro: string | null
  mensagem: string
}

export const iaService = {
  async lerModo(): Promise<{ id: string; modo: ModoIa } | null> {
    try {
      const r = await pb
        .collection('configuracoes')
        .getFirstListItem<{ id: string; valor_texto: string }>("chave = 'ia_modo'", {
          requestKey: null,
        })
      return { id: r.id, modo: (r.valor_texto as ModoIa) || 'rascunho' }
    } catch {
      return null
    }
  },
  async salvarModo(id: string, modo: ModoIa): Promise<void> {
    await pb.collection('configuracoes').update(id, { valor_texto: modo })
  },

  async modelosNegocio(): Promise<{ id: string; nome: string }[]> {
    const r = await pb
      .collection('modelos_negocio')
      .getList<{ id: string; nome: string }>(1, 50, { sort: 'nome' })
    return r.items
  },
  async regras(): Promise<RegraRoteamentoRecord[]> {
    const r = await pb
      .collection('regras_roteamento')
      .getList<RegraRoteamentoRecord>(1, 50, { requestKey: null })
    return r.items
  },
  async salvarRegra(
    dados: Partial<RegraRoteamentoRecord> & { modelo_negocio: string },
    id?: string,
  ) {
    return id
      ? await pb.collection('regras_roteamento').update<RegraRoteamentoRecord>(id, dados)
      : await pb.collection('regras_roteamento').create<RegraRoteamentoRecord>(dados)
  },

  async janelas(vendedor: string): Promise<JanelaRecord[]> {
    const r = await pb.collection('janelas_executivo').getList<JanelaRecord>(1, 100, {
      filter: pb.filter('vendedor = {:v}', { v: vendedor }),
      sort: 'dia_semana,inicio',
      requestKey: null,
    })
    return r.items
  },
  async criarJanela(dados: Omit<JanelaRecord, 'id'>) {
    return await pb.collection('janelas_executivo').create<JanelaRecord>(dados)
  },
  async alterarJanela(id: string, dados: Partial<JanelaRecord>) {
    return await pb.collection('janelas_executivo').update<JanelaRecord>(id, dados)
  },
  async removerJanela(id: string) {
    await pb.collection('janelas_executivo').delete(id)
  },
  async previaHorarios(vendedor: string): Promise<PreviaHorarios> {
    return await pb.send<PreviaHorarios>('/backend/v1/ia/horarios-previa', {
      method: 'GET',
      query: { vendedor },
      requestKey: null,
    })
  },

  async conhecimentos(): Promise<ConhecimentoRecord[]> {
    const r = await pb.collection('base_conhecimento').getList<ConhecimentoRecord>(1, 200, {
      sort: 'tipo,titulo',
      expand: 'produto',
      requestKey: null,
    })
    return r.items
  },
  async salvarConhecimento(dados: Partial<ConhecimentoRecord>, id?: string) {
    return id
      ? await pb.collection('base_conhecimento').update<ConhecimentoRecord>(id, dados)
      : await pb.collection('base_conhecimento').create<ConhecimentoRecord>(dados)
  },
  async removerConhecimento(id: string) {
    await pb.collection('base_conhecimento').delete(id)
  },

  async envios(): Promise<{ itens: EnvioIaRecord[]; total: number }> {
    const r = await pb.collection('ia_envios').getList<EnvioIaRecord>(1, 20, {
      sort: '-criado_em',
      expand: 'lead',
      requestKey: null,
    })
    return { itens: r.items, total: r.totalItems }
  },
  async rascunhosPendentes(): Promise<number> {
    try {
      const r = await pb
        .collection('ia_envios')
        .getList(1, 1, { filter: "status = 'rascunho'", requestKey: null })
      return r.totalItems
    } catch {
      return 0
    }
  },
}
