import pb from '@/lib/pocketbase/client'
import { calcularAteProposta } from '@/lib/metricas'
import type { InteracaoRecord, InteracaoTipo } from '@/types'

// a regra da contagem vive em @/lib/metricas (função pura, coberta por testes automáticos)
export { calcularAteProposta }

export const TIPOS_INTERACAO: InteracaoTipo[] = [
  'Ligação',
  'Reunião',
  'E-mail',
  'WhatsApp',
  'Visita',
  'Outro',
]

const EXPAND = 'responsavel,cancelada_por'
// Volume por lead é baixo na Fase 1: uma página de 200 cobre a timeline inteira
// (sem getFullList — mesmo padrão de paginação server-side do projeto).
const LIMITE_POR_LEAD = 200

export const interacoesService = {
  // timeline do lead, mais recente primeiro (o filtro chega montado pela camada de cima)
  async listarPorLead(leadId: string): Promise<InteracaoRecord[]> {
    const r = await pb.collection('interacoes').getList<InteracaoRecord>(1, LIMITE_POR_LEAD, {
      filter: pb.filter('lead = {:lead}', { lead: leadId }),
      sort: '-data,-created',
      expand: EXPAND,
    })
    return r.items
  },

  async criar(dados: {
    lead: string
    tipo: InteracaoTipo
    data: string // YYYY-MM-DD
    observacao?: string
    responsavel?: string
  }): Promise<InteracaoRecord> {
    // meio-dia UTC: a data escolhida não muda de dia ao exibir no fuso de Brasília
    return await pb.collection('interacoes').create<InteracaoRecord>(
      {
        lead: dados.lead,
        tipo: dados.tipo,
        data: `${dados.data} 12:00:00.000Z`,
        observacao: dados.observacao?.trim() || '',
        responsavel: dados.responsavel || '',
        proposta: false,
        cancelada: false,
      },
      { expand: EXPAND },
    )
  },

  // F1-T20: marcar proposta — exige observação (validado também no hook)
  async marcarProposta(item: InteracaoRecord, observacao?: string): Promise<InteracaoRecord> {
    const obs = (observacao ?? item.observacao ?? '').trim()
    if (!obs) {
      throw new Error('Para marcar a proposta, descreva na observação o que foi proposto.')
    }
    return await pb
      .collection('interacoes')
      .update<InteracaoRecord>(item.id, { proposta: true, observacao: obs }, { expand: EXPAND })
  },

  // F1-T21: cancelar — motivo obrigatório; o registro é preservado (nunca apagado)
  async cancelar(id: string, motivo: string): Promise<InteracaoRecord> {
    if (!motivo.trim()) {
      throw new Error('Para cancelar a interação, informe o motivo.')
    }
    return await pb
      .collection('interacoes')
      .update<InteracaoRecord>(
        id,
        { cancelada: true, cancelada_motivo: motivo.trim() },
        { expand: EXPAND },
      )
  },

  // F1-T20: contagem até a proposta direto da base (null = sem proposta)
  async contarAteProposta(leadId: string): Promise<number | null> {
    const itens = await this.listarPorLead(leadId)
    return calcularAteProposta(itens)
  },
}
