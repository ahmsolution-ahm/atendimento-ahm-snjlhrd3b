import pb from '@/lib/pocketbase/client'
import type { AtendimentoRecord, AtendimentoStatus, CanalAtendimento } from '@/types'

export const atendimentosService = {
  async list(filter?: string, sort: string = '-created'): Promise<AtendimentoRecord[]> {
    return await pb.collection('atendimentos').getFullList<AtendimentoRecord>({
      filter,
      sort,
      expand: 'ticket,usuario',
    })
  },

  async create(data: {
    ticket: string
    canal: CanalAtendimento
    status?: AtendimentoStatus
  }): Promise<AtendimentoRecord> {
    const currentUserId = pb.authStore.record?.id
    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19) + 'Z'

    const record = await pb.collection('atendimentos').create<AtendimentoRecord>(
      {
        ticket: data.ticket,
        usuario: currentUserId,
        canal: data.canal,
        status: data.status || 'Ativo',
        inicio_atendimento: nowIso,
      },
      {
        expand: 'ticket,usuario',
      },
    )

    try {
      await pb.collection('logs_tickets').create({
        ticket: data.ticket,
        acao: 'Atendimento iniciado',
        usuario: currentUserId,
        detalhes: `Atendimento em andamento via canal ${data.canal}`,
      })
    } catch {
      /* intentionally ignored */
    }

    return record
  },

  async updateStatus(id: string, status: AtendimentoStatus): Promise<AtendimentoRecord> {
    const payload: Record<string, unknown> = { status }
    if (status === 'Encerrado') {
      payload.fim_atendimento = new Date().toISOString().replace('T', ' ').substring(0, 19) + 'Z'
    }

    return await pb.collection('atendimentos').update<AtendimentoRecord>(id, payload, {
      expand: 'ticket,usuario',
    })
  },
}
