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
import type { InteracaoRecord } from '@/types'

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
export type FonteMetricas = 'todas' | 'manual' | 'csv' | 'demo'

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
