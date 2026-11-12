import pb from '@/lib/pocketbase/client'
import type { InteracaoRecord, InteracaoTipo } from '@/types'

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

/**
 * F1-T20 (CA-1-020): nº de interações NÃO canceladas até (inclusive) a que tem proposta.
 * Retorna null quando não há proposta ativa — diferente de "proposta na 1ª interação".
 * Ordem cronológica: data e, em empate (mesmo dia), ordem de registro.
 */
export function calcularAteProposta(itens: InteracaoRecord[]): number | null {
  const ativas = itens
    .filter((i) => !i.cancelada)
    .sort((a, b) => {
      const d = a.data.localeCompare(b.data)
      return d !== 0 ? d : a.created.localeCompare(b.created)
    })
  const idx = ativas.findIndex((i) => i.proposta)
  return idx >= 0 ? idx + 1 : null
}

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
