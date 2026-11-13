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
// F2-T01 — emenda 1.2a: campos de entrada
export type AreaInteresse = 'Qualidade no Transporte' | 'Cadeia do Frio' | 'Segurança e Logística'
export type Idioma = 'pt-BR' | 'es' | 'en'
export type ModeloCompra = 'Nacional' | 'Importação'

// F2-T02/T03/T04 — emendas 1.2a e 1.2b: pipeline de duas trilhas
export type AmbienteFechamento = 'Venda em reais' | 'Locação em reais' | 'Exportação (EUA)'
export type Trilha = 'baixa' | 'alta'

export interface PipelineEtapaRecord extends RecordModel {
  trilha: Trilha
  ordem: number
  nome: string
  fase: 'Pré-venda' | 'Venda' | 'Pós-venda'
  taxa_alvo?: number
}

export interface OportunidadeEtapaRecord extends RecordModel {
  oportunidade: string
  etapa: string
  entrou_em: string
  saiu_em?: string
  responsavel?: string
  expand?: {
    etapa?: PipelineEtapaRecord
    responsavel?: UserRecord
  }
}

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
  ambiente_fechamento?: AmbienteFechamento | ''
  moeda?: 'BRL' | 'USD' | ''
  entidade_vendedora?: 'AHM Brasil' | 'AHM Solution Americas' | ''
  valor_estimado?: number
  trilha?: Trilha | ''
  etapa_atual?: string
  etapa_desde?: string
  expand?: {
    lead?: LeadRecord
    produto?: ProdutoRecord
    decidido_por?: UserRecord
    etapa_atual?: PipelineEtapaRecord
  }
}

export type InteracaoTipo = 'Ligação' | 'Reunião' | 'E-mail' | 'WhatsApp' | 'Visita' | 'Outro'

export interface InteracaoRecord extends RecordModel {
  lead: string
  tipo: InteracaoTipo
  data: string
  responsavel?: string
  observacao?: string
  proposta?: boolean
  cancelada?: boolean
  cancelada_em?: string
  cancelada_motivo?: string
  cancelada_por?: string
  criado_em?: string
  expand?: {
    responsavel?: UserRecord
    cancelada_por?: UserRecord
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
  telefone?: string
  area_interesse?: AreaInteresse | ''
  pais?: string
  idioma?: Idioma | ''
  modelo_compra?: ModeloCompra | ''
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
  qualificacao_origem?: 'manual' | 'automatica' | ''
  expand?: {
    produto_interesse?: ProdutoRecord
    responsavel?: UserRecord
    qualificado_por?: UserRecord
  }
}
