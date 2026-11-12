export type TicketStatus = 'Aberto' | 'Em andamento' | 'Resolvido' | 'Fechado'
export type TicketPrioridade = 'Baixa' | 'Média' | 'Alta' | 'Urgente'
export type CanalAtendimento = 'Email' | 'Telefone' | 'WhatsApp' | 'Chat'
export type AtendimentoStatus = 'Ativo' | 'Aguardando resposta' | 'Encerrado'
export type ProdutoStatus = 'Ativo' | 'Inativo'
export type ProdutoTipoVenda = 'Recorrente' | 'Pontual'
export type ProdutoComplexidade = 'Baixa' | 'Alta'

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

export interface ProdutoRecord extends RecordModel {
  nome: string
  familia?: string
  tipo_venda: ProdutoTipoVenda
  icp: string
  dor: string
  escopo: string
  perguntas: string
  faq?: string
  timing?: string
  complexidade: ProdutoComplexidade
  especialista?: string
  status: ProdutoStatus
  incompleto?: boolean
  familia_tecnologica?: string
  modelo_negocio?: string
  expand?: {
    especialista?: UserRecord
    familia_tecnologica?: TemplateDiagnosticoRecord
    modelo_negocio?: ModeloNegocioRecord
  }
}

export type LeadStatus =
  | 'novo'
  | 'em qualificação'
  | 'qualificado'
  | 'pendente'
  | 'fora do recorte'
  | 'transbordo'
export type LeadUrgencia = 'Baixa' | 'Média' | 'Alta'

export interface OportunidadeRecord extends RecordModel {
  lead: string
  produto?: string
  justificativa: string
  confianca?: 'alta' | 'média' | 'baixa'
  status: 'Sugerida' | 'Aprovada' | 'Rejeitada' | 'Em revisão'
  comentario?: string
  criado_em?: string
  atualizado_em?: string
  decidido_em?: string
  decidido_por?: string
  expand?: {
    lead?: LeadRecord
    produto?: ProdutoRecord
    decidido_por?: UserRecord
  }
}

export interface TransbordoRecord extends RecordModel {
  lead: string
  produto?: string
  motivo: string
  especialista?: string
  status: 'Pendente atribuição' | 'Aberto' | 'Resolvido'
  comentario?: string
  resolucao?: string
  resolvido_em?: string
  resolvido_por?: string
  expand?: {
    lead?: LeadRecord
    produto?: ProdutoRecord
    especialista?: UserRecord
    resolvido_por?: UserRecord
  }
}

export interface LeadRecord extends RecordModel {
  nome: string
  empresa: string
  contato: string
  origem?: string
  produto_interesse?: string
  dor?: string
  urgencia?: LeadUrgencia
  observacoes?: string
  responsavel?: string
  status: LeadStatus
  incompleto?: boolean
  qualificacao_resultado?: string
  qualificacao_pendencias?: string[]
  qualificado_em?: string
  qualificado_por?: string
  qualificacao_historico?: string
  expand?: {
    produto_interesse?: ProdutoRecord
    responsavel?: UserRecord
    qualificado_por?: UserRecord
  }
}
