import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { ticketsService } from '@/services/tickets'
import { comentariosService, logsService } from '@/services/comentarios'
import type {
  TicketRecord,
  TicketStatus,
  TicketPrioridade,
  CanalAtendimento,
  ComentarioRecord,
  LogTicketRecord,
} from '@/types'
import { StatusBadge, PrioridadeBadge, CanalBadge } from '@/components/Badges'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import {
  Search,
  Plus,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  History,
  Send,
  User,
  AlertTriangle,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

export default function Tickets() {
  const { toast } = useToast()

  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('Todos')
  const [prioridadeFilter, setPrioridadeFilter] = useState<string>('Todas')

  // Paginação
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 6

  // Modal Novo Ticket
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [newForm, setNewForm] = useState({
    assunto: '',
    cliente: '',
    descricao: '',
    prioridade: 'Média' as TicketPrioridade,
    canal: 'Email' as CanalAtendimento,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Modal Detalhes do Ticket
  const [selectedTicket, setSelectedTicket] = useState<TicketRecord | null>(null)
  const [comentarios, setComentarios] = useState<ComentarioRecord[]>([])
  const [logs, setLogs] = useState<LogTicketRecord[]>([])
  const [novoComentario, setNovoComentario] = useState('')
  const [isAddingComment, setIsAddingComment] = useState(false)

  // Modal Confirmação de Exclusão
  const [ticketToDelete, setTicketToDelete] = useState<TicketRecord | null>(null)

  const loadTickets = useCallback(async () => {
    try {
      const data = await ticketsService.list()
      setTickets(data)
    } catch {
      /* intentionally ignored */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTickets()
  }, [loadTickets])

  useRealtime<TicketRecord>('tickets', () => {
    loadTickets()
  })

  // Carregar comentários e logs ao abrir detalhes
  const openDetails = async (ticket: TicketRecord) => {
    setSelectedTicket(ticket)
    try {
      const [c, l] = await Promise.all([
        comentariosService.listByTicket(ticket.id),
        logsService.listByTicket(ticket.id),
      ])
      setComentarios(c)
      setLogs(l)
    } catch {
      /* intentionally ignored */
    }
  }

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!selectedTicket) return
    try {
      const updated = await ticketsService.updateStatus(selectedTicket.id, newStatus)
      setSelectedTicket(updated)
      toast({
        title: 'Status atualizado!',
        description: `O ticket agora está marcado como "${newStatus}".`,
      })
      loadTickets()
      // Recarregar logs
      const updatedLogs = await logsService.listByTicket(selectedTicket.id)
      setLogs(updatedLogs)
    } catch (_) {
      toast({
        title: 'Erro ao atualizar status',
        variant: 'destructive',
      })
    }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTicket || !novoComentario.trim()) return

    setIsAddingComment(true)
    try {
      const comment = await comentariosService.add(selectedTicket.id, novoComentario.trim())
      setComentarios((prev) => [...prev, comment])
      setNovoComentario('')
      toast({
        title: 'Comentário registrado!',
        description: 'Nota interna adicionada com sucesso.',
      })
      const updatedLogs = await logsService.listByTicket(selectedTicket.id)
      setLogs(updatedLogs)
    } catch (_) {
      toast({
        title: 'Erro ao enviar comentário',
        variant: 'destructive',
      })
    } finally {
      setIsAddingComment(false)
    }
  }

  const handleDeleteTicket = async () => {
    if (!ticketToDelete) return
    try {
      await ticketsService.delete(ticketToDelete.id)
      toast({
        title: 'Ticket excluído com sucesso',
      })
      if (selectedTicket?.id === ticketToDelete.id) {
        setSelectedTicket(null)
      }
      setTicketToDelete(null)
      loadTickets()
    } catch (_) {
      toast({
        title: 'Erro ao excluir ticket',
        variant: 'destructive',
      })
    }
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newForm.assunto || !newForm.cliente) return

    setIsSubmitting(true)
    try {
      await ticketsService.create({
        assunto: newForm.assunto,
        cliente: newForm.cliente,
        descricao: newForm.descricao,
        prioridade: newForm.prioridade,
        canal: newForm.canal,
      })
      toast({
        title: 'Ticket criado com sucesso!',
      })
      setIsNewModalOpen(false)
      setNewForm({
        assunto: '',
        cliente: '',
        descricao: '',
        prioridade: 'Média',
        canal: 'Email',
      })
      loadTickets()
    } catch (_) {
      toast({
        title: 'Erro ao criar ticket',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filtragem
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchesSearch =
        t.ticket_id.toLowerCase().includes(search.toLowerCase()) ||
        t.assunto.toLowerCase().includes(search.toLowerCase()) ||
        t.cliente.toLowerCase().includes(search.toLowerCase())

      const matchesStatus = statusFilter === 'Todos' || t.status === statusFilter

      const matchesPrioridade = prioridadeFilter === 'Todas' || t.prioridade === prioridadeFilter

      return matchesSearch && matchesStatus && matchesPrioridade
    })
  }, [tickets, search, statusFilter, prioridadeFilter])

  // Paginação
  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / itemsPerPage))
  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredTickets.slice(start, start + itemsPerPage)
  }, [filteredTickets, currentPage])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho com Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#030507]">Central de Tickets</h1>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Gerencie, responda e monitore as demandas comerciais dos clientes
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsNewModalOpen(true)}
          className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white shadow-md transition-all hover:bg-[#C94F4F] flex items-center gap-2 self-start sm:self-auto"
          style={{ backgroundColor: '#DE6464' }}
        >
          <Plus className="w-4 h-4" />
          <span>Novo Ticket</span>
        </button>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-[#E5E7EB] shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Input de Busca */}
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9CA3AF]">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setCurrentPage(1)
            }}
            placeholder="Buscar por ID, cliente ou assunto..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] outline-none focus:border-[#DE6464]"
          />
        </div>

        {/* Pills de Status */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {['Todos', 'Aberto', 'Em andamento', 'Resolvido', 'Fechado'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setStatusFilter(st)
                setCurrentPage(1)
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === st
                  ? 'bg-[#030507] text-white'
                  : 'bg-[#FAF7F2] text-[#6B7280] hover:bg-gray-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Dropdown de Prioridade */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <span className="text-xs text-[#6B7280]">Prioridade:</span>
          <select
            value={prioridadeFilter}
            onChange={(e) => {
              setPrioridadeFilter(e.target.value)
              setCurrentPage(1)
            }}
            className="px-3 py-1.5 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] bg-white outline-none focus:border-[#DE6464]"
          >
            <option value="Todas">Todas</option>
            <option value="Baixa">Baixa</option>
            <option value="Média">Média</option>
            <option value="Alta">Alta</option>
            <option value="Urgente">Urgente</option>
          </select>
        </div>
      </div>

      {/* Tabela de Tickets (Desktop) / Cards (Mobile) */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        {/* Tabela Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF7F2] text-[#6B7280] font-semibold border-b border-[#E5E7EB] uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-5">ID</th>
                <th className="py-3 px-5">Assunto & Cliente</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5">Prioridade</th>
                <th className="py-3 px-5">Canal</th>
                <th className="py-3 px-5">Responsável</th>
                <th className="py-3 px-5">Criado em</th>
                <th className="py-3 px-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] text-[#030507]">
              {paginatedTickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-[#FAF7F2]/60 transition-colors">
                  <td className="py-3.5 px-5 font-mono font-bold text-[#DE6464]">
                    {ticket.ticket_id}
                  </td>
                  <td className="py-3.5 px-5">
                    <p className="font-semibold text-[#030507] max-w-xs truncate">
                      {ticket.assunto}
                    </p>
                    <p className="text-[11px] text-[#6B7280] truncate">{ticket.cliente}</p>
                  </td>
                  <td className="py-3.5 px-5">
                    <StatusBadge status={ticket.status} />
                  </td>
                  <td className="py-3.5 px-5">
                    <PrioridadeBadge prioridade={ticket.prioridade} />
                  </td>
                  <td className="py-3.5 px-5">
                    <CanalBadge canal={ticket.canal} />
                  </td>
                  <td className="py-3.5 px-5 text-[#6B7280]">
                    {ticket.expand?.responsavel?.name || 'Comercial AHM'}
                  </td>
                  <td className="py-3.5 px-5 text-[#6B7280]">
                    {new Date(ticket.created).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit',
                    })}
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openDetails(ticket)}
                        title="Ver detalhes"
                        className="p-1.5 rounded-lg border border-[#E5E7EB] text-[#030507] hover:bg-[#FAF7F2] transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setTicketToDelete(ticket)}
                        title="Excluir ticket"
                        className="p-1.5 rounded-lg border border-[#E5E7EB] text-[#DC2626] hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedTickets.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-[#6B7280]">
                    Nenhum ticket encontrado com os filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Cards Mobile */}
        <div className="md:hidden divide-y divide-[#E5E7EB]">
          {paginatedTickets.map((ticket) => (
            <div key={ticket.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs text-[#DE6464]">
                  {ticket.ticket_id}
                </span>
                <StatusBadge status={ticket.status} />
              </div>
              <div>
                <h2 className="text-xs font-bold text-[#030507]">{ticket.assunto}</h2>
                <p className="text-[11px] text-[#6B7280]">{ticket.cliente}</p>
              </div>
              <div className="flex items-center gap-2">
                <PrioridadeBadge prioridade={ticket.prioridade} />
                <CanalBadge canal={ticket.canal} />
                <span className="text-[10px] text-[#9CA3AF] ml-auto">
                  {new Date(ticket.created).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => openDetails(ticket)}
                  className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-xs font-semibold text-[#030507] flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" /> Detalhes
                </button>
                <button
                  type="button"
                  onClick={() => setTicketToDelete(ticket)}
                  className="px-3 py-1.5 rounded-lg border border-red-200 text-xs font-semibold text-[#DC2626] flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Excluir
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Paginação */}
        <div className="p-4 border-t border-[#E5E7EB] flex items-center justify-between text-xs text-[#6B7280]">
          <div>
            Mostrando{' '}
            <span className="font-semibold text-[#030507]">{paginatedTickets.length}</span> de{' '}
            <span className="font-semibold text-[#030507]">{filteredTickets.length}</span> tickets
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-[#E5E7EB] text-[#030507] hover:bg-[#FAF7F2] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-medium text-[#030507]">
              Página {currentPage} de {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-[#E5E7EB] text-[#030507] hover:bg-[#FAF7F2] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Detalhes do Ticket */}
      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        {selectedTicket && (
          <DialogContent className="max-w-3xl bg-white p-6 rounded-2xl modal-ahm max-h-[90vh] overflow-y-auto">
            <DialogHeader className="border-b border-[#E5E7EB] pb-4">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-sm text-[#DE6464]">
                  {selectedTicket.ticket_id}
                </span>
                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedTicket.status} />
                  <PrioridadeBadge prioridade={selectedTicket.prioridade} />
                </div>
              </div>
              <DialogTitle className="text-xl font-bold text-[#030507] mt-2">
                {selectedTicket.assunto}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#6B7280]">
                Cliente: <strong className="text-[#030507]">{selectedTicket.cliente}</strong> •
                Canal: {selectedTicket.canal} • Criado em:{' '}
                {new Date(selectedTicket.created).toLocaleString('pt-BR')}
              </DialogDescription>
            </DialogHeader>

            {/* Descrição do Chamado */}
            <div className="mt-4 p-4 rounded-xl bg-[#FAF7F2] border border-[#E5E7EB]">
              <h3 className="text-xs font-bold text-[#030507] uppercase tracking-wider mb-1.5">
                Descrição da Demanda
              </h3>
              <p className="text-xs text-[#030507] leading-relaxed whitespace-pre-wrap">
                {selectedTicket.descricao || 'Nenhuma descrição detalhada informada.'}
              </p>
            </div>

            {/* Ações de Status Rápido */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-[#E5E7EB]">
              <span className="text-xs font-semibold text-[#030507]">Alterar Status:</span>
              <div className="flex items-center gap-2">
                {(['Aberto', 'Em andamento', 'Resolvido', 'Fechado'] as TicketStatus[]).map(
                  (st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleStatusChange(st)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                        selectedTicket.status === st
                          ? 'bg-[#030507] text-white border-[#030507]'
                          : 'bg-white text-[#6B7280] border-[#E5E7EB] hover:bg-gray-100'
                      }`}
                    >
                      {st}
                    </button>
                  ),
                )}
              </div>
            </div>

            {/* Abas de Histórico e Comentários */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Comentários / Notas Internas */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#030507]">
                  <MessageSquare className="w-4 h-4 text-[#DE6464]" />
                  <span>Comentários & Notas Internas</span>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-2.5 pr-1">
                  {comentarios.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-xl bg-white border border-[#E5E7EB] text-xs shadow-2xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-[10px] text-[#6B7280]">
                        <span className="font-semibold text-[#030507]">
                          {c.expand?.autor?.name || 'Colaborador AHM'}
                        </span>
                        <span>
                          {new Date(c.created).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-[#030507] leading-relaxed">{c.conteudo}</p>
                    </div>
                  ))}
                  {comentarios.length === 0 && (
                    <p className="text-xs text-[#6B7280] py-3 text-center">
                      Nenhum comentário registrado ainda.
                    </p>
                  )}
                </div>

                {/* Form Adicionar Comentário */}
                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    type="text"
                    value={novoComentario}
                    onChange={(e) => setNovoComentario(e.target.value)}
                    placeholder="Adicionar nota interna..."
                    className="flex-1 px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs outline-none focus:border-[#DE6464]"
                  />
                  <button
                    type="submit"
                    disabled={isAddingComment || !novoComentario.trim()}
                    className="p-2.5 rounded-xl text-white shadow disabled:opacity-50"
                    style={{ backgroundColor: '#DE6464' }}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>

              {/* Histórico / Trilha de Auditoria (Logs) */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#030507]">
                  <History className="w-4 h-4 text-[#E5BE94]" />
                  <span>Trilha de Histórico & Auditoria</span>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-xl bg-[#FAF7F2] border border-[#E5E7EB] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-[#030507]">{log.acao}</span>
                        <span className="text-[#6B7280]">
                          {new Date(log.created).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {log.detalhes && <p className="text-[11px] text-[#6B7280]">{log.detalhes}</p>}
                      <div className="text-[10px] text-[#9CA3AF] flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>{log.expand?.usuario?.name || 'Sistema AHM'}</span>
                      </div>
                    </div>
                  ))}
                  {logs.length === 0 && (
                    <p className="text-xs text-[#6B7280] py-3 text-center">
                      Nenhum registro de log encontrado.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Modal Criar Novo Ticket */}
      <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
        <DialogContent className="max-w-lg bg-white p-6 rounded-2xl modal-ahm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#030507]">
              Cadastrar Novo Ticket
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B7280]">
              Informe os dados da demanda comercial do cliente para acompanhamento.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 mt-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1">
                Cliente / Razão Social *
              </label>
              <input
                type="text"
                required
                value={newForm.cliente}
                onChange={(e) => setNewForm({ ...newForm, cliente: e.target.value })}
                placeholder="Ex: TransLog Sul Distribuidora"
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] outline-none focus:border-[#DE6464]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1">
                Assunto do Chamado *
              </label>
              <input
                type="text"
                required
                value={newForm.assunto}
                onChange={(e) => setNewForm({ ...newForm, assunto: e.target.value })}
                placeholder="Ex: Reajuste de Tabela ou Ocorrência de Carga"
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] outline-none focus:border-[#DE6464]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1">
                  Prioridade
                </label>
                <select
                  value={newForm.prioridade}
                  onChange={(e) =>
                    setNewForm({ ...newForm, prioridade: e.target.value as TicketPrioridade })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] bg-white outline-none focus:border-[#DE6464]"
                >
                  <option value="Baixa">Baixa</option>
                  <option value="Média">Média</option>
                  <option value="Alta">Alta</option>
                  <option value="Urgente">Urgente</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1">
                  Canal
                </label>
                <select
                  value={newForm.canal}
                  onChange={(e) =>
                    setNewForm({ ...newForm, canal: e.target.value as CanalAtendimento })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] bg-white outline-none focus:border-[#DE6464]"
                >
                  <option value="Email">Email</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Telefone">Telefone</option>
                  <option value="Chat">Chat</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1">
                Descrição
              </label>
              <textarea
                rows={3}
                value={newForm.descricao}
                onChange={(e) => setNewForm({ ...newForm, descricao: e.target.value })}
                placeholder="Detalhes sobre a rota, volumes, notas fiscais ou histórico..."
                className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] outline-none focus:border-[#DE6464]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[#6B7280] hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-md disabled:opacity-60"
                style={{ backgroundColor: '#DE6464' }}
              >
                {isSubmitting ? 'Salvando...' : 'Criar Ticket'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar Exclusão */}
      <Dialog open={!!ticketToDelete} onOpenChange={(open) => !open && setTicketToDelete(null)}>
        {ticketToDelete && (
          <DialogContent className="max-w-md bg-white p-6 rounded-2xl modal-ahm">
            <DialogHeader>
              <div className="w-10 h-10 rounded-xl bg-red-100 text-[#DC2626] flex items-center justify-center mb-2">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <DialogTitle className="text-lg font-bold text-[#030507]">
                Excluir Ticket Permanentemente?
              </DialogTitle>
              <DialogDescription className="text-xs text-[#6B7280]">
                Você tem certeza que deseja remover o ticket{' '}
                <strong className="text-[#030507]">{ticketToDelete.ticket_id}</strong>? Esta ação
                não poderá ser desfeita.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setTicketToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[#6B7280] hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteTicket}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#DC2626] hover:bg-red-700 shadow"
              >
                Excluir
              </button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
