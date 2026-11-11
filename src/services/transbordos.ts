import pb from '@/lib/pocketbase/client'
import type { TransbordoRecord } from '@/types'

export interface TransbordosPaginados {
  itens: TransbordoRecord[]
  total: number
  totalPaginas: number
  pagina: number
  porPagina: number
}

export const transbordosService = {
  // F1-T10: fila paginada server-side (padrão da F1-T09 — nunca getFullList em base grande)
  async listPaginado(
    pagina: number = 1,
    porPagina: number = 20,
    filter?: string,
  ): Promise<TransbordosPaginados> {
    const r = await pb.collection('transbordos').getList<TransbordoRecord>(pagina, porPagina, {
      filter,
      sort: '-created',
      expand: 'lead,produto,especialista,resolvido_por',
    })
    return {
      itens: r.items,
      total: r.totalItems,
      totalPaginas: r.totalPages,
      pagina: r.page,
      porPagina: r.perPage,
    }
  },

  async contadores(): Promise<{ total: number; abertos: number; pendentes: number }> {
    const [total, abertos, pendentes] = await Promise.all([
      pb.collection('transbordos').getList(1, 1, {}),
      pb.collection('transbordos').getList(1, 1, { filter: "status='Aberto'" }),
      pb.collection('transbordos').getList(1, 1, { filter: "status='Pendente atribuição'" }),
    ])
    return {
      total: total.totalItems,
      abertos: abertos.totalItems,
      pendentes: pendentes.totalItems,
    }
  },

  async getById(id: string): Promise<TransbordoRecord> {
    return await pb.collection('transbordos').getOne<TransbordoRecord>(id, {
      expand: 'lead,produto,especialista,resolvido_por',
    })
  },

  // atribuir especialista (cenário limite: item "Pendente atribuição" ganha dono → vira Aberto)
  async atribuir(id: string, especialista: string): Promise<TransbordoRecord> {
    return await pb.collection('transbordos').update<TransbordoRecord>(id, {
      especialista,
      status: 'Aberto',
    })
  },

  // RN-1.12: resolver exige resolução preenchida (validada também no hook backend)
  async resolver(id: string, resolucao: string): Promise<TransbordoRecord> {
    if (!resolucao.trim()) {
      throw new Error('Resolução vazia não fecha o transbordo (RN-1.12).')
    }
    return await pb.collection('transbordos').update<TransbordoRecord>(id, {
      status: 'Resolvido',
      resolucao,
    })
  },

  // reabrir com motivo (SPEC 1.4: rollback — transbordo pode ser reaberto)
  async reabrir(id: string, comentario: string): Promise<TransbordoRecord> {
    if (!comentario.trim()) {
      throw new Error('Reabertura exige comentário com o motivo (SPEC 1.4).')
    }
    return await pb.collection('transbordos').update<TransbordoRecord>(id, {
      status: 'Aberto',
      comentario,
    })
  },
}
