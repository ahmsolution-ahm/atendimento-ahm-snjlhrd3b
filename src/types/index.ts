export type TicketStatus = 'Aberto' | 'Em andamento' | 'Resolvido' | 'Fechado'
export type TicketPrioridade = 'Baixa' | 'Média' | 'Alta' | 'Urgente'
export type CanalAtendimento = 'Email' | 'Telefone' | 'WhatsApp' | 'Chat'
export type AtendimentoStatus = 'Ativo' | 'Aguardando resposta' | 'Encerrado'

import type { RecordModel } from 'pocketbase'

export interface UserRecord extends RecordModel {
  email: string
  name?: string
  avatar?: string
}

export interface TicketRecord extends RecordModel {
  ticket_id: string
  assunto: string
  cliente: string
  descricao?: string
  status: TicketStatus
  prioridade: TicketPrioridade
  canal: CanalAtendimento
  responsavel?: string
  created_by?: string
  expand?: {
    responsavel?: UserRecord
    created_by?: UserRecord
  }
}

export interface AtendimentoRecord extends RecordModel {
  ticket: string
  usuario: string
  status: AtendimentoStatus
  canal: CanalAtendimento
  inicio_atendimento?: string
  fim_atendimento?: string
  expand?: {
    ticket?: TicketRecord
    usuario?: UserRecord
  }
}

export interface ComentarioRecord extends RecordModel {
  ticket: string
  autor: string
  conteudo: string
  expand?: {
    autor?: UserRecord
  }
}

export interface LogTicketRecord extends RecordModel {
  ticket: string
  acao: string
  usuario?: string
  detalhes?: string
  expand?: {
    usuario?: UserRecord
  }
}
