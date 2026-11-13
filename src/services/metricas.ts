import pb from '@/lib/pocketbase/client'
import {
  calcularAteProposta,
  calcularK1,
  calcularK2,
  calcularK3,
  juntarFiltros,
  type ResultadoK1,
  type ResultadoK2,
  type ResultadoK3,
} from '@/lib/metricas'
import type { InteracaoRecord, PipelineEtapaRecord } from '@/types'
import { lerTodasPaginas } from '@/lib/paginacao'
import {
  calcularTaxasPassagem,
  taxaVitoria,
  type PassagemEtapa,
  type TaxaEtapa,
} from '@/lib/pipeline'

export interface DadosPipeline {
  baixa: TaxaEtapa[]
  alta: TaxaEtapa[]
  passagens: number
  ganhas: number
  perdidas: number
  taxaVitoria: number | null
}

// F1-T16 — SPEC 1.6: leitura dos dados para os indicadores.
// Tudo é CONTADO no servidor (getList com 1 item por página → totalItems) — nunca carrega
// a base de 15 mil leads. Os filtros chegam como expressões completas montadas pela tela.

const contar = async (colecao: string, filter: string): Promise<number> => {
  const r = await pb.collection(colecao).getList(1, 1, filter ? { filter } : {})
  return r.totalItems
}

export interface DadosK1 extends ResultadoK1 {
  qualificadosManual: number
  semProduto: number
}

export type DadosK3 = ResultadoK3

// períodos e fontes aceitos pela rota de capacidade (valores fixos — o servidor recusa outros)
export type DiasMetricas = 7 | 30 | 90 | null
export type FonteMetricas = 'todas' | 'manual' | 'csv' | 'lp' | 'demo' | 'outras'

export const metricasService = {
  /**
   * Qualificação automática. Denominador = leads recebidos no recorte piloto (produto de
   * baixa complexidade); numerador = desses, os qualificados SEM intervenção humana.
   * Leads sem produto ainda não podem ser classificados no recorte — contados à parte.
   */
  async qualificacaoAutomatica(filtroLeads: string): Promise<DadosK1> {
    const recorte = juntarFiltros(filtroLeads, "produto_interesse.complexidade = 'Baixa'")
    const [recebidos, auto, manual, semProduto] = await Promise.all([
      contar('leads', recorte),
      contar(
        'leads',
        juntarFiltros(recorte, "status = 'qualificado'", "qualificacao_origem = 'automatica'"),
      ),
      contar(
        'leads',
        juntarFiltros(recorte, "status = 'qualificado'", "qualificacao_origem != 'automatica'"),
      ),
      contar('leads', juntarFiltros(filtroLeads, "produto_interesse = ''")),
    ])
    return { ...calcularK1(auto, recebidos), qualificadosManual: manual, semProduto }
  },

  /**
   * Interações até a proposta. Considera as propostas ativas (não canceladas) do período
   * e, para cada lead, conta as interações não canceladas até a proposta.
   */
  async interacoesAteProposta(filtroPropostas: string): Promise<ResultadoK2> {
    const propostas = await pb.collection('interacoes').getList<InteracaoRecord>(1, 200, {
      filter: juntarFiltros('proposta = true', 'cancelada = false', filtroPropostas),
      fields: 'id,lead',
    })
    const leads = [...new Set(propostas.items.map((p) => p.lead))]
    if (leads.length === 0) return calcularK2([])

    // busca as interações desses leads em lotes de 50 (filtro por id, sem carregar a coleção)
    const porLead = new Map<string, InteracaoRecord[]>()
    for (let i = 0; i < leads.length; i += 50) {
      const lote = leads.slice(i, i + 50)
      const filtro = lote.map((id) => pb.filter('lead = {:id}', { id })).join(' || ')
      const r = await pb.collection('interacoes').getList<InteracaoRecord>(1, 1000, {
        filter: filtro,
        fields: 'id,lead,data,created,proposta,cancelada',
      })
      for (const it of r.items) {
        const lista = porLead.get(it.lead) || []
        lista.push(it)
        porLead.set(it.lead, lista)
      }
    }
    return calcularK2(leads.map((id) => calcularAteProposta(porLead.get(id) || [])))
  },

  /**
   * Fase 2 · Bloco 2 (RN-2.3): taxas de passagem real × alvo por etapa das duas trilhas,
   * a partir do histórico de etapas (oportunidade_etapas), e taxa de vitória dos fechamentos.
   * Período: pela data de entrada na etapa e pela data do fechamento.
   */
  async pipeline(inicio: string | null): Promise<DadosPipeline> {
    const etapasR = await pb
      .collection('pipeline_etapas')
      .getList<PipelineEtapaRecord>(1, 50, { sort: 'trilha,ordem' })
    const passagens: PassagemEtapa[] = []
    await lerTodasPaginas<PassagemEtapa>(
      (pagina, comTotal) =>
        pb.collection('oportunidade_etapas').getList<PassagemEtapa & { id: string }>(pagina, 500, {
          filter: inicio ? `entrou_em >= '${inicio}'` : '',
          fields: 'oportunidade,etapa,entrou_em',
          sort: 'created,id',
          skipTotal: !comTotal,
          requestKey: null,
        }),
      500,
      (itens) => passagens.push(...itens),
    )
    const fechadoNoPeriodo = inicio ? ` && fechado_em >= '${inicio}'` : ''
    const [ganhas, perdidas] = await Promise.all([
      contar('oportunidades', `resultado = 'ganha'${fechadoNoPeriodo}`),
      contar('oportunidades', `resultado = 'perdida'${fechadoNoPeriodo}`),
    ])
    return {
      baixa: calcularTaxasPassagem(etapasR.items, 'baixa', passagens),
      alta: calcularTaxasPassagem(etapasR.items, 'alta', passagens),
      passagens: passagens.length,
      ganhas,
      perdidas,
      taxaVitoria: taxaVitoria(ganhas, perdidas),
    }
  },

  /**
   * Capacidade por vendedor — agregada no servidor (rota metricas_capacidade.js), porque o
   * usuário logado não tem acesso à lista de usuários. Processado = lead que passou pela
   * qualificação (não é novo, não está em qualificação, não é rascunho).
   */
  async capacidadePorVendedor(dias: DiasMetricas, fonte: FonteMetricas): Promise<DadosK3> {
    const r = await pb.send<{
      vendedores: { id: string; nome: string; processados: number }[]
      semResponsavel: number
    }>('/backend/v1/metricas/capacidade', {
      method: 'GET',
      query: { dias: dias === null ? 'todos' : String(dias), fonte },
    })
    return calcularK3(r.vendedores || [], r.semResponsavel || 0)
  },
}
