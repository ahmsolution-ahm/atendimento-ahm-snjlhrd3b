import React from 'react'
import type { TicketStatus, TicketPrioridade, CanalAtendimento } from '@/types'

export const StatusBadge: React.FC<{ status: TicketStatus | string }> = ({ status }) => {
  const styles: Record<string, { bg: string; text: string; dot: string }> = {
    Aberto: { bg: 'bg-red-50 border-red-200', text: 'text-[#DC2626]', dot: 'bg-[#DC2626]' },
    'Em andamento': {
      bg: 'bg-amber-50 border-amber-200',
      text: 'text-[#D97706]',
      dot: 'bg-[#F59E0B]',
    },
    Resolvido: {
      bg: 'bg-emerald-50 border-emerald-200',
      text: 'text-[#059669]',
      dot: 'bg-[#10B981]',
    },
    Fechado: { bg: 'bg-gray-100 border-gray-200', text: 'text-[#4B5563]', dot: 'bg-[#6B7280]' },
  }

  const s = styles[status] || styles.Aberto

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${s.bg} ${s.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  )
}

export const PrioridadeBadge: React.FC<{ prioridade: TicketPrioridade | string }> = ({
  prioridade,
}) => {
  const styles: Record<string, { bg: string; text: string }> = {
    Baixa: { bg: 'bg-blue-50 border-blue-200 text-blue-700', text: 'Baixa' },
    Média: { bg: 'bg-amber-50 border-amber-200 text-amber-700', text: 'Média' },
    Alta: { bg: 'bg-orange-50 border-orange-200 text-orange-700', text: 'Alta' },
    Urgente: { bg: 'bg-red-50 border-red-200 text-[#DC2626] font-bold', text: 'Urgente' },
  }

  const p = styles[prioridade] || styles.Média

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${p.bg}`}
    >
      {prioridade}
    </span>
  )
}

export const CanalBadge: React.FC<{ canal: CanalAtendimento | string }> = ({ canal }) => {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#FAF7F2] border border-[#E5E7EB] text-[#030507]">
      {canal}
    </span>
  )
}
