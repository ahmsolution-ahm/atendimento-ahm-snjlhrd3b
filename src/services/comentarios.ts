import pb from '@/lib/pocketbase/client'
import type { ComentarioRecord, LogTicketRecord } from '@/types'

export const comentariosService = {
  async listByTicket(ticketId: string): Promise<ComentarioRecord[]> {
    return await pb.collection('comentarios').getFullList<ComentarioRecord>({
      filter: `ticket = "${ticketId}"`,
      sort: 'created',
      expand: 'autor',
    })
  },

  async add(ticketId: string, conteudo: string): Promise<ComentarioRecord> {
    const currentUserId = pb.authStore.record?.id
    const record = await pb.collection('comentarios').create<ComentarioRecord>(
      {
        ticket: ticketId,
        autor: currentUserId,
        conteudo,
      },
      {
        expand: 'autor',
      },
    )

    try {
      await pb.collection('logs_tickets').create({
        ticket: ticketId,
        acao: 'Novo comentário adicionado',
        usuario: currentUserId,
        detalhes: conteudo.slice(0, 80) + (conteudo.length > 80 ? '...' : ''),
      })
    } catch {
      /* intentionally ignored */
    }

    return record
  },
}

export const logsService = {
  async listByTicket(ticketId: string): Promise<LogTicketRecord[]> {
    return await pb.collection('logs_tickets').getFullList<LogTicketRecord>({
      filter: `ticket = "${ticketId}"`,
      sort: '-created',
      expand: 'usuario',
    })
  },
}
