import pb from '@/lib/pocketbase/client'

// Fase 2 · Bloco C — indicadores de Desempenho (agregados no servidor: hooks/desempenho.js),
// motivos de perda (lista fixa administrável) e configurações simples do administrador.

export type PeriodoDesempenho = 'mes' | '3m' | '6m' | '12m' | 'todos'
export type TrilhaDesempenho = 'todas' | 'alta' | 'baixa'

export interface ValoresPorMoeda {
  qtd: number
  BRL: number
  USD: number
  semValor: number
}

export interface EtapaAberta extends ValoresPorMoeda {
  etapaId: string
  trilha: 'alta' | 'baixa'
  ordem: number
  nome: string
  fase: string
  negociacao: boolean
}

export interface ItemNegociacao {
  id: string
  lead: string
  empresa: string
  moeda: string
  valor: number
  etapa: string
  responsavel: string
  desde: string
}

export interface MesDesempenho {
  mes: string // AAAA-MM
  criadas: number
  meta: number
  ganhas: number
  ganhasBRL: number
  ganhasUSD: number
}

export interface LinhaResponsavel {
  id: string
  nome: string
  criadas: number
  abertas: number
  ganhas: number
  perdidas: number
  ganhoBRL: number
  ganhoUSD: number
  taxaVitoria: number | null
}

export interface DadosDesempenho {
  filtros: {
    periodo: PeriodoDesempenho
    trilha: TrilhaDesempenho
    responsavel: string
    inicio: string
    admin: boolean
  }
  abertas: ValoresPorMoeda
  naoIniciadas: ValoresPorMoeda
  abertasPorEtapa: EtapaAberta[]
  negociacao: ValoresPorMoeda
  emNegociacao: ItemNegociacao[]
  meta: number
  totalCriadas: number
  porMes: MesDesempenho[]
  ganhas: {
    qtd: number
    BRL: number
    USD: number
    qtdBRL: number
    qtdUSD: number
    semValor: number
  }
  perdidas: number
  taxaVitoria: number | null
  ticketMedio: { BRL: number | null; USD: number | null }
  perdasPorEtapa: { nome: string; trilha: string; ordem: number; qtd: number }[]
  perdasPorMotivo: { motivo: string; semClassificacao: boolean; qtd: number }[]
  duracao: {
    ganhas: number | null
    perdidas: number | null
    qtdGanhas: number
    qtdPerdidas: number
  }
  tempoPorEtapa: {
    nome: string
    trilha: string
    ordem: number
    dias: number | null
    passagens: number
  }[]
  funil: { etapa: string; qtd: number }[]
  porResponsavel: LinhaResponsavel[]
}

export interface MotivoPerdaRecord {
  id: string
  nome: string
  grupo?: string
  ordem?: number
  ativo?: boolean
  exige_detalhe?: boolean
}

export const CHAVE_META_CRIADAS = 'meta_negocios_criados_mes'

export const desempenhoService = {
  async carregar(
    periodo: PeriodoDesempenho,
    trilha: TrilhaDesempenho,
    responsavel: string,
  ): Promise<DadosDesempenho> {
    return await pb.send<DadosDesempenho>('/backend/v1/desempenho', {
      method: 'GET',
      query: { periodo, trilha, responsavel },
      requestKey: null,
    })
  },

  // lista fixa (coleção pequena — dezenas de itens); ativos para escolha, todos para o admin
  async motivosPerda(somenteAtivos = true): Promise<MotivoPerdaRecord[]> {
    const r = await pb.collection('motivos_perda').getList<MotivoPerdaRecord>(1, 200, {
      filter: somenteAtivos ? 'ativo = true' : '',
      sort: 'ordem,nome',
      requestKey: null,
    })
    return r.items
  },

  async alternarMotivo(id: string, ativo: boolean): Promise<void> {
    await pb.collection('motivos_perda').update(id, { ativo })
  },

  async lerMeta(): Promise<{ id: string; valor: number } | null> {
    try {
      const r = await pb
        .collection('configuracoes')
        .getFirstListItem<{ id: string; valor_numero: number }>(
          pb.filter('chave = {:c}', { c: CHAVE_META_CRIADAS }),
          { requestKey: null },
        )
      return { id: r.id, valor: r.valor_numero || 0 }
    } catch {
      return null
    }
  },

  async salvarMeta(id: string, valor: number): Promise<void> {
    await pb.collection('configuracoes').update(id, { valor_numero: valor })
  },
}
