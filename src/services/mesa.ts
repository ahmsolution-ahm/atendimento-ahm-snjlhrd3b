import pb from '@/lib/pocketbase/client'
import type { LeadRecord, OportunidadeRecord, TransbordoRecord } from '@/types'

// Fase 2 · Bloco C — "Minha mesa": o que o vendedor tem para fazer hoje.
// Tudo paginado no servidor (listas curtas + total); nunca carrega a base inteira.
// usuarioId vazio = visão do time (administrador).

export interface ListaCurta<T> {
  itens: T[]
  total: number
}

export const mesaService = {
  async oportunidadesAbertas(usuarioId: string): Promise<ListaCurta<OportunidadeRecord>> {
    const filtros = ["resultado = ''", "status != 'Rejeitada'"]
    if (usuarioId) filtros.push(pb.filter('responsavel = {:u}', { u: usuarioId }))
    const r = await pb.collection('oportunidades').getList<OportunidadeRecord>(1, 12, {
      filter: filtros.join(' && '),
      sort: '-updated',
      expand: 'lead,produto,etapa_atual,responsavel',
      requestKey: null,
    })
    return { itens: r.items, total: r.totalItems }
  },

  async leadsParaTrabalhar(usuarioId: string): Promise<ListaCurta<LeadRecord>> {
    const filtros = [
      "(status = 'novo' || status = 'em qualificação' || status = 'pendente')",
      'arquivado != true',
      'incompleto != true',
    ]
    if (usuarioId) filtros.push(pb.filter('responsavel = {:u}', { u: usuarioId }))
    const r = await pb.collection('leads').getList<LeadRecord>(1, 8, {
      filter: filtros.join(' && '),
      sort: '-created',
      requestKey: null,
    })
    return { itens: r.items, total: r.totalItems }
  },

  async transbordosAbertos(usuarioId: string): Promise<ListaCurta<TransbordoRecord>> {
    const filtros = ["status != 'Resolvido'"]
    if (usuarioId) {
      filtros.push(pb.filter('(especialista = {:u} || lead.responsavel = {:u})', { u: usuarioId }))
    }
    const r = await pb.collection('transbordos').getList<TransbordoRecord>(1, 6, {
      filter: filtros.join(' && '),
      sort: '-created',
      expand: 'lead,especialista',
      requestKey: null,
    })
    return { itens: r.items, total: r.totalItems }
  },
}
