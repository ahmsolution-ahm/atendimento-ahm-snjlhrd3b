import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { atendimentosService } from '@/services/atendimentos'
import { ticketsService } from '@/services/tickets'
import { usersService } from '@/services/users'
import type {
  AtendimentoRecord,
  TicketRecord,
  UserRecord,
  AtendimentoStatus,
  CanalAtendimento,
} from '@/types'
import { CanalBadge } from '@/components/Badges'
import { LiveTimer } from '@/components/LiveTimer'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import {
  Headphones,
  Clock,
  CheckCircle,
  PlayCircle,
  Plus,
  Radio,
  User,
  ArrowRight,
  Filter,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

export default function Atendimentos() {
  const { toast } = useToast()

  const [atendimentos, setAtendimentos] = useState<AtendimentoRecord[]>([])
  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [statusFilter, setStatusFilter] = useState<string>('Todos')
  const [responsavelFilter, setResponsavelFilter] = useState<string>('Todos')

  // Modal Novo Atendimento
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState('')
  const [canalAtendimento, setCanalAtendimento] = useState<CanalAtendimento>('WhatsApp')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Modal Sala do Atendimento ("Entrar no atendimento")
  const [activeSession, setActiveSession] = useState<AtendimentoRecord | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [aList, tList, uList] = await Promise.all([
        atendimentosService.list(),
        ticketsService.list(),
        usersService.list(),
      ])
      setAtendimentos(aList)
      setTickets(tList)
      setUsers(uList)
    } catch {
      /* intentionally ignored */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Real-time: atualizações ao vivo
  useRealtime<AtendimentoRecord>('atendimentos', () => {
    loadData()
  })

  // Cards Resumo
  const totalAtivos = useMemo(
    () => atendimentos.filter((a) => a.status === 'Ativo').length,
    [atendimentos],
  )
  const totalAguardando = useMemo(
    () => atendimentos.filter((a) => a.status === 'Aguardando resposta').length,
    [atendimentos],
  )
  const totalEncerrados = useMemo(
    () => atendimentos.filter((a) => a.status === 'Encerrado').length,
    [atendimentos],
  )

  const filteredAtendimentos = useMemo(() => {
    return atendimentos.filter((a) => {
      const matchStatus = statusFilter === 'Todos' || a.status === statusFilter
      const matchResp = responsavelFilter === 'Todos' || a.usuario === responsavelFilter

      return matchStatus && matchResp
    })
  }, [atendimentos, statusFilter, responsavelFilter])

  const handleStartAtendimento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTicketId) return

    setIsSubmitting(true)
    try {
      await atendimentosService.create({
        ticket: selectedTicketId,
        canal: canalAtendimento,
      })
      toast({
        title: 'Atendimento iniciado!',
        description: 'A sessão em tempo real foi registrada.',
      })
      setIsNewModalOpen(false)
      setSelectedTicketId('')
      loadData()
    } catch (_) {
      toast({
        title: 'Erro ao iniciar atendimento',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateStatus = async (atendimentoId: string, newStatus: AtendimentoStatus) => {
    try {
      await atendimentosService.updateStatus(atendimentoId, newStatus)
      toast({
        title: 'Status do atendimento atualizado',
        description: `Alterado para ${newStatus}.`,
      })
      if (activeSession?.id === atendimentoId) {
        setActiveSession((prev) => (prev ? { ...prev, status: newStatus } : null))
      }
      loadData()
    } catch (_) {
      toast({
        title: 'Erro ao alterar status',
        variant: 'destructive',
      })
    }
  }

  const getStatusBadge = (status: AtendimentoStatus) => {
    switch (status) {
      case 'Ativo':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 border border-emerald-200 text-[#10B981]">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
            Em Atendimento
          </span>
        )
      case 'Aguardando resposta':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 border border-amber-200 text-[#D97706]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
            Aguardando Cliente
          </span>
        )
      case 'Encerrado':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-100 border border-gray-200 text-[#6B7280]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF]" />
            Finalizado
          </span>
        )
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#DE6464] mb-1">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Fila Operacional & Real-Time</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#030507]">Atendimentos em Andamento</h1>
          <p className="text-xs text-[#6B7280]">
            Acompanhe a duração e os canais de contato ativos com os clientes
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsNewModalOpen(true)}
          className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white shadow-md transition-all hover:bg-[#C94F4F] flex items-center gap-2 self-start sm:self-auto"
          style={{ backgroundColor: '#DE6464' }}
        >
          <Plus className="w-4 h-4" />
          <span>Iniciar Atendimento</span>
        </button>
      </div>

      {/* Cards Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
              Ativos Agora
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#10B981] mt-1">
              {totalAtivos}
            </div>
            <p className="text-[11px] text-[#6B7280] mt-0.5">Com timer ao vivo em execução</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-[#10B981] flex items-center justify-center">
            <Headphones className="w-6 h-6" strokeWidth={1.5} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
              Aguardando Resposta
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#F59E0B] mt-1">
              {totalAguardando}
            </div>
            <p className="text-[11px] text-[#6B7280] mt-0.5">Pendente de retorno do cliente</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-[#F59E0B] flex items-center justify-center">
            <Clock className="w-6 h-6" strokeWidth={1.5} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
              Encerrados Hoje
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#030507] mt-1">
              {totalEncerrados}
            </div>
            <p className="text-[11px] text-[#6B7280] mt-0.5">Sessões concluídas com sucesso</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-gray-100 text-[#030507] flex items-center justify-center">
            <CheckCircle className="w-6 h-6" strokeWidth={1.5} />
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-[#030507] font-semibold w-full sm:w-auto">
          <Filter className="w-4 h-4 text-[#DE6464]" />
          <span>Filtros rápidos:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-1.5">
            {['Todos', 'Ativo', 'Aguardando resposta', 'Encerrado'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  statusFilter === st
                    ? 'bg-[#030507] text-white'
                    : 'bg-[#FAF7F2] text-[#6B7280] hover:bg-gray-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#6B7280]">Responsável:</span>
            <select
              value={responsavelFilter}
              onChange={(e) => setResponsavelFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] bg-white outline-none focus:border-[#DE6464]"
            >
              <option value="Todos">Todos</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lista de Atendimentos (Cards Horizontais) */}
      <div className="space-y-3">
        {filteredAtendimentos.map((at) => (
          <div
            key={at.id}
            className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            {/* Informações Principais */}
            <div className="flex items-start gap-4 min-w-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: at.status === 'Ativo' ? 'rgba(16, 185, 129, 0.15)' : '#FAF7F2',
                  color: at.status === 'Ativo' ? '#10B981' : '#6B7280',
                }}
              >
                <Headphones className="w-5 h-5" strokeWidth={1.5} />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-mono font-bold text-xs text-[#DE6464]">
                    {at.expand?.ticket?.ticket_id || 'Ticket Vinculado'}
                  </span>
                  <CanalBadge canal={at.canal} />
                  {getStatusBadge(at.status)}
                </div>
                <h2 className="text-sm font-bold text-[#030507] truncate">
                  {at.expand?.ticket?.assunto || 'Atendimento Comercial'}
                </h2>
                <p className="text-xs text-[#6B7280] truncate">
                  Cliente:{' '}
                  <strong className="text-[#030507]">
                    {at.expand?.ticket?.cliente || 'Empresa Cliente'}
                  </strong>{' '}
                  • Responsável: {at.expand?.usuario?.name || 'Comercial'}
                </p>
              </div>
            </div>

            {/* Timer e Ações */}
            <div className="flex items-center justify-between md:justify-end gap-5 pt-3 md:pt-0 border-t md:border-t-0 border-[#E5E7EB]">
              {/* Live Timer */}
              <div className="text-right">
                <span className="block text-[10px] uppercase font-semibold text-[#9CA3AF]">
                  Duração
                </span>
                <LiveTimer
                  inicioIso={at.inicio_atendimento}
                  fimIso={at.fim_atendimento}
                  status={at.status}
                />
              </div>

              {/* Botão Entrar no Atendimento */}
              <button
                type="button"
                onClick={() => setActiveSession(at)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white shadow transition-all hover:bg-[#C94F4F] flex items-center gap-2"
                style={{ backgroundColor: '#DE6464' }}
              >
                <PlayCircle className="w-4 h-4" />
                <span>Entrar no atendimento</span>
              </button>
            </div>
          </div>
        ))}

        {filteredAtendimentos.length === 0 && !loading && (
          <div className="bg-white p-12 rounded-2xl border border-[#E5E7EB] text-center text-[#6B7280]">
            <Headphones className="w-10 h-10 mx-auto text-[#9CA3AF] mb-3" />
            <p className="text-sm font-semibold text-[#030507]">Nenhum atendimento encontrado</p>
            <p className="text-xs text-[#6B7280] mt-1">
              Ajuste os filtros de status e responsável ou inicie um novo atendimento.
            </p>
          </div>
        )}
      </div>

      {/* Modal Iniciar Atendimento */}
      <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
        <DialogContent className="max-w-md bg-white p-6 rounded-2xl modal-ahm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#030507]">
              Iniciar Novo Atendimento
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B7280]">
              Vincule o atendimento a um ticket existente da carteira comercial.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleStartAtendimento} className="space-y-4 mt-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1">
                Selecione o Ticket *
              </label>
              <select
                required
                value={selectedTicketId}
                onChange={(e) => setSelectedTicketId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] bg-white outline-none focus:border-[#DE6464]"
              >
                <option value="">Escolha um ticket aberto ou em andamento...</option>
                {tickets
                  .filter((t) => t.status !== 'Fechado')
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.ticket_id} - {t.cliente} ({t.assunto})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1">
                Canal de Contato
              </label>
              <select
                value={canalAtendimento}
                onChange={(e) => setCanalAtendimento(e.target.value as CanalAtendimento)}
                className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] bg-white outline-none focus:border-[#DE6464]"
              >
                <option value="WhatsApp">WhatsApp</option>
                <option value="Telefone">Telefone</option>
                <option value="Email">Email</option>
                <option value="Chat">Chat</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[#6B7280]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !selectedTicketId}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-md disabled:opacity-50"
                style={{ backgroundColor: '#DE6464' }}
              >
                {isSubmitting ? 'Iniciando...' : 'Iniciar Sessão'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Sala de Atendimento */}
      <Dialog open={!!activeSession} onOpenChange={(open) => !open && setActiveSession(null)}>
        {activeSession && (
          <DialogContent className="max-w-2xl bg-white p-6 rounded-2xl modal-ahm">
            <DialogHeader className="border-b border-[#E5E7EB] pb-4">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs text-[#DE6464]">
                  {activeSession.expand?.ticket?.ticket_id}
                </span>
                {getStatusBadge(activeSession.status)}
              </div>
              <DialogTitle className="text-lg font-bold text-[#030507] mt-1">
                {activeSession.expand?.ticket?.assunto || 'Atendimento Comercial'}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#6B7280]">
                Cliente:{' '}
                <strong className="text-[#030507]">{activeSession.expand?.ticket?.cliente}</strong>{' '}
                • Canal: {activeSession.canal}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* Painel do Timer ao vivo */}
              <div className="p-4 rounded-xl bg-[#030507] text-white flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#9CA3AF] uppercase tracking-wider block">
                    Cronômetro da Sessão
                  </span>
                  <div className="text-2xl font-mono font-bold text-[#E5BE94] mt-0.5">
                    <LiveTimer
                      inicioIso={activeSession.inicio_atendimento}
                      fimIso={activeSession.fim_atendimento}
                      status={activeSession.status}
                    />
                  </div>
                </div>
                <div className="text-right text-xs text-[#9CA3AF]">
                  <span>Operador Responsável:</span>
                  <p className="font-semibold text-white flex items-center gap-1 justify-end mt-0.5">
                    <User className="w-3.5 h-3.5 text-[#DE6464]" />
                    {activeSession.expand?.usuario?.name || 'Afonso Moreira'}
                  </p>
                </div>
              </div>

              {/* Informações do Ticket */}
              <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E5E7EB] text-xs space-y-2">
                <span className="font-bold text-[#030507] uppercase tracking-wider text-[10px] block">
                  Resumo da Demanda
                </span>
                <p className="text-[#030507] leading-relaxed">
                  {activeSession.expand?.ticket?.descricao ||
                    'Cliente em contato direto com a central para alinhamento operacional.'}
                </p>
              </div>

              {/* Controles de Status do Atendimento */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <span className="text-xs font-semibold text-[#030507]">
                  Atualizar Estado da Sessão:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(activeSession.id, 'Ativo')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                      activeSession.status === 'Ativo'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-emerald-600 border-emerald-200'
                    }`}
                  >
                    Ativo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(activeSession.id, 'Aguardando resposta')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                      activeSession.status === 'Aguardando resposta'
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-white text-amber-600 border-amber-200'
                    }`}
                  >
                    Aguardando Resposta
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(activeSession.id, 'Encerrado')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                      activeSession.status === 'Encerrado'
                        ? 'bg-[#030507] text-white border-[#030507]'
                        : 'bg-white text-[#030507] border-gray-300'
                    }`}
                  >
                    Finalizar Sessão
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => setActiveSession(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white"
                style={{ backgroundColor: '#DE6464' }}
              >
                Concluir Visualização
              </button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
