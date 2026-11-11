import pb from '@/lib/pocketbase/client'
import type { OportunidadeRecord } from '@/types'

export interface OportunidadesPaginadas {
  itens: OportunidadeRecord[]
  total: number
  totalPaginas: number
  pagina: number
  porPagina: number
}

export const oportunidadesService = {
  // F1-T13: fila paginada server-side (padrão das demais telas — nunca getFullList em base grande)
  async listPaginado(
    pagina: number = 1,
    porPagina: number = 20,
    filter?: string,
  ): Promise<OportunidadesPaginadas> {
    const r = await pb.collection('oportunidades').getList<OportunidadeRecord>(pagina, porPagina, {
      filter,
      sort: '-created',
      expand: 'lead,produto',
    })
    return {
      itens: r.items,
      total: r.totalItems,
      totalPaginas: r.totalPages,
      pagina: r.page,
      porPagina: r.perPage,
    }
  },

  async contadores(): Promise<{ total: number; sugeridas: number; aprovadas: number }> {
    const [total, sugeridas, aprovadas] = await Promise.all([
      pb.collection('oportunidades').getList(1, 1, {}),
      pb.collection('oportunidades').getList(1, 1, { filter: "status='Sugerida'" }),
      pb.collection('oportunidades').getList(1, 1, { filter: "status='Aprovada'" }),
    ])
    return {
      total: total.totalItems,
      sugeridas: sugeridas.totalItems,
      aprovadas: aprovadas.totalItems,
    }
  },

  async getById(id: string): Promise<OportunidadeRecord> {
    return await pb.collection('oportunidades').getOne<OportunidadeRecord>(id, {
      expand: 'lead,produto',
    })
  },
}
