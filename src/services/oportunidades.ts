import pb from '@/lib/pocketbase/client'
import type { OportunidadeRecord } from '@/types'

export interface OportunidadesPaginadas {
  itens: OportunidadeRecord[]
  total: number
  totalPaginas: number
  pagina: number
  porPagina: number
}

export interface OportunidadesContadores {
  total: number
  sugeridas: number
  aprovadas: number
  rejeitadas: number
  emRevisao: number
}

const EXPAND = 'lead,produto,decidido_por'

// F1-T14: o comentario acumula o histórico — cada decisão acrescenta uma linha
const acumularComentario = (anterior: string | undefined, linha: string) => {
  const base = (anterior || '').trim()
  return base ? `${base}\n${linha}` : linha
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
      expand: EXPAND,
    })
    return {
      itens: r.items,
      total: r.totalItems,
      totalPaginas: r.totalPages,
      pagina: r.page,
      porPagina: r.perPage,
    }
  },

  async contadores(): Promise<OportunidadesContadores> {
    const [total, sugeridas, aprovadas, rejeitadas, emRevisao] = await Promise.all([
      pb.collection('oportunidades').getList(1, 1, {}),
      pb.collection('oportunidades').getList(1, 1, { filter: "status='Sugerida'" }),
      pb.collection('oportunidades').getList(1, 1, { filter: "status='Aprovada'" }),
      pb.collection('oportunidades').getList(1, 1, { filter: "status='Rejeitada'" }),
      pb.collection('oportunidades').getList(1, 1, { filter: "status='Em revisão'" }),
    ])
    return {
      total: total.totalItems,
      sugeridas: sugeridas.totalItems,
      aprovadas: aprovadas.totalItems,
      rejeitadas: rejeitadas.totalItems,
      emRevisao: emRevisao.totalItems,
    }
  },

  async getById(id: string): Promise<OportunidadeRecord> {
    return await pb.collection('oportunidades').getOne<OportunidadeRecord>(id, {
      expand: EXPAND,
    })
  },

  // F1-T14: aprovar — comentário opcional (decidido_em/por gravados pelo hook)
  async aprovar(item: OportunidadeRecord, comentario?: string): Promise<OportunidadeRecord> {
    const dados: Record<string, string> = { status: 'Aprovada' }
    if (comentario?.trim()) {
      dados.comentario = acumularComentario(item.comentario, `Aprovação: ${comentario.trim()}`)
    }
    return await pb
      .collection('oportunidades')
      .update<OportunidadeRecord>(item.id, dados, { expand: EXPAND })
  },

  // F1-T14: pedir revisão — comentário opcional, exceto no rollback de Aprovada (hook valida)
  async pedirRevisao(item: OportunidadeRecord, comentario?: string): Promise<OportunidadeRecord> {
    const dados: Record<string, string> = { status: 'Em revisão' }
    if (comentario?.trim()) {
      const rotulo = item.status === 'Aprovada' ? 'Volta para revisão' : 'Pedido de revisão'
      dados.comentario = acumularComentario(item.comentario, `${rotulo}: ${comentario.trim()}`)
    }
    return await pb
      .collection('oportunidades')
      .update<OportunidadeRecord>(item.id, dados, { expand: EXPAND })
  },

  // F1-T14/T15 (RN-1.14): rejeitar exige motivo — validado na UI, aqui e no hook backend
  async rejeitar(item: OportunidadeRecord, motivo: string): Promise<OportunidadeRecord> {
    if (!motivo.trim()) {
      throw new Error('Informe o motivo da rejeição.')
    }
    return await pb.collection('oportunidades').update<OportunidadeRecord>(
      item.id,
      {
        status: 'Rejeitada',
        comentario: acumularComentario(item.comentario, `Motivo da rejeição: ${motivo.trim()}`),
      },
      { expand: EXPAND },
    )
  },
}
