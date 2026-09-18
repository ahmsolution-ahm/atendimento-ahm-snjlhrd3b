import pb from '@/lib/pocketbase/client'
import type { TicketRecord, TicketStatus, TicketPrioridade, CanalAtendimento } from '@/types'

export const ticketsService = {
  async list(filter?: string, sort: string = '-created'): Promise<TicketRecord[]> {
    return await pb.collection('tickets').getFullList<TicketRecord>({
      filter,
      sort,
      expand: 'responsavel,created_by',
    })
  },

  async getById(id: string): Promise<TicketRecord> {
    return await pb.collection('tickets').getOne<TicketRecord>(id, {
      expand: 'responsavel,created_by',
    })
  },

  async create(data: {
    assunto: string
    cliente: string
    descricao?: string
    prioridade: TicketPrioridade
    canal: CanalAtendimento
    status?: TicketStatus
    responsavel?: string
  }): Promise<TicketRecord> {
    // Gerar ticket_id legível AHM-YYYY-XXX
    const count = await pb.collection('tickets').getList(1, 1)
    const year = new Date().getFullYear()
    const nextSeq = String((count.totalItems || 0) + 1).padStart(3, '0')
    const ticket_id = `AHM-${year}-${nextSeq}`

    const currentUserId = pb.authStore.record?.id

    const record = await pb.collection('tickets').create<TicketRecord>(
      {
        ticket_id,
        assunto: data.assunto,
        cliente: data.cliente,
        descricao: data.descricao || '',
        status: data.status || 'Aberto',
        prioridade: data.prioridade,
        canal: data.canal,
        responsavel: data.responsavel || currentUserId,
        created_by: currentUserId,
      },
      {
        expand: 'responsavel,created_by',
      },
    )

    // Log de criação
    try {
      await pb.collection('logs_tickets').create({
        ticket: record.id,
        acao: 'Ticket criado',
        usuario: currentUserId,
        detalhes: `Criado via canal ${data.canal} com prioridade ${data.prioridade}`,
      })
    } catch {
      /* intentionally ignored */
    }

    return record
  },

  async updateStatus(id: string, status: TicketStatus): Promise<TicketRecord> {
    const currentUserId = pb.authStore.record?.id
    const updated = await pb.collection('tickets').update<TicketRecord>(
      id,
      {
        status,
      },
      {
        expand: 'responsavel,created_by',
      },
    )

    try {
      await pb.collection('logs_tickets').create({
        ticket: id,
        acao: `Status alterado para ${status}`,
        usuario: currentUserId,
        detalhes: `Status atualizado no portal`,
      })
    } catch {
      /* intentionally ignored */
    }

    return updated
  },

  async delete(id: string): Promise<boolean> {
    return await pb.collection('tickets').delete(id)
  },
}
