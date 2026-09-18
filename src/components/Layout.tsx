import React, { useState, useEffect, useCallback } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from '@/components/Logo'
import {
  LayoutDashboard,
  Ticket,
  Headphones,
  Users,
  LogOut,
  Menu,
  X,
  Bell,
  PlusCircle,
} from 'lucide-react'
import { useRealtime } from '@/hooks/use-realtime'
import pb from '@/lib/pocketbase/client'
import type { TicketRecord, TicketPrioridade, CanalAtendimento } from '@/types'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ticketsService } from '@/services/tickets'

export default function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [newTicketsCount, setNewTicketsCount] = useState(0)
  const [recentNotifications, setRecentNotifications] = useState<TicketRecord[]>([])

  // Modal Novo Ticket global
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false)
  const [newTicketForm, setNewTicketForm] = useState({
    assunto: '',
    cliente: '',
    descricao: '',
    prioridade: 'Média' as TicketPrioridade,
    canal: 'Email' as CanalAtendimento,
  })
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false)

  // Carregar tickets criados nas últimas 24h para badge de notificações
  const loadRecentTickets = useCallback(async () => {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const list = await pb.collection('tickets').getList<TicketRecord>(1, 10, {
        filter: `created >= "${oneDayAgo}"`,
        sort: '-created',
      })
      setNewTicketsCount(list.totalItems)
      setRecentNotifications(list.items)
    } catch {
      /* intentionally ignored */
    }
  }, [])

  useEffect(() => {
    loadRecentTickets()
  }, [loadRecentTickets])

  // Real-time: escutar novos tickets
  useRealtime<TicketRecord>('tickets', (e) => {
    if (e.action === 'create') {
      setNewTicketsCount((prev) => prev + 1)
      setRecentNotifications((prev) => [e.record, ...prev.slice(0, 9)])
      toast({
        title: 'Novo ticket recebido!',
        description: `${e.record.ticket_id}: ${e.record.assunto} (${e.record.cliente})`,
      })
    }
  })

  const handleLogout = () => {
    logout()
    toast({
      title: 'Sessão encerrada',
      description: 'Você saiu da sua conta com segurança.',
    })
    navigate('/login')
  }

  const handleCreateTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTicketForm.assunto || !newTicketForm.cliente) return

    setIsSubmittingTicket(true)
    try {
      await ticketsService.create({
        assunto: newTicketForm.assunto,
        cliente: newTicketForm.cliente,
        descricao: newTicketForm.descricao,
        prioridade: newTicketForm.prioridade,
        canal: newTicketForm.canal,
      })
      toast({
        title: 'Ticket criado com sucesso!',
        description: 'O novo ticket já está disponível na listagem comercial.',
      })
      setIsNewTicketOpen(false)
      setNewTicketForm({
        assunto: '',
        cliente: '',
        descricao: '',
        prioridade: 'Média',
        canal: 'Email',
      })
    } catch (err: unknown) {
      toast({
        title: 'Erro ao criar ticket',
        description: err instanceof Error ? err.message : 'Falha na conexão.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmittingTicket(false)
    }
  }

  // Título dinâmico da página atual
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'Dashboard Geral'
      case '/tickets':
        return 'Gestão de Tickets'
      case '/atendimentos':
        return 'Atendimentos em Tempo Real'
      case '/equipe':
        return 'Equipe Comercial & Suporte'
      default:
        return 'Atendimento AHM'
    }
  }

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Tickets', path: '/tickets', icon: Ticket },
    { name: 'Atendimentos', path: '/atendimentos', icon: Headphones },
    { name: 'Equipe', path: '/equipe', icon: Users },
  ]

  return (
    <div className="min-h-screen flex bg-[#FAF7F2] text-[#030507]">
      {/* Sidebar Desktop Fixa 256px */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#030507] text-white shrink-0 sidebar-ahm z-30 select-none">
        {/* Topo: Logo */}
        <div className="h-16 flex items-center px-6 border-b border-[#1A1F26]">
          <Logo variant="light" size="md" />
        </div>

        {/* Botão de Ação Rápida */}
        <div className="p-4">
          <button
            type="button"
            onClick={() => setIsNewTicketOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white shadow-md transition-all duration-150 hover:bg-[#C94F4F] active:scale-[0.98]"
            style={{ backgroundColor: '#DE6464' }}
          >
            <PlusCircle className="w-4 h-4" strokeWidth={1.5} />
            <span>Novo Ticket</span>
          </button>
        </div>

        {/* Menu de Navegação */}
        <nav className="flex-1 px-3 py-2 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 relative ${
                  isActive
                    ? 'text-white bg-[#DE6464] shadow-md shadow-[#DE6464]/20'
                    : 'text-[#9CA3AF] hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#9CA3AF]'}`}
                  strokeWidth={1.5}
                />
                <span>{item.name}</span>
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />}
              </NavLink>
            )
          })}
        </nav>

        {/* Base: Usuário Logado + Logout */}
        <div className="p-3 border-t border-[#1A1F26]">
          <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.04]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white shrink-0"
                style={{ backgroundColor: '#DE6464' }}
              >
                {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">
                  {user?.name || 'Afonso Moreira'}
                </p>
                <p className="text-[10px] text-[#9CA3AF] truncate">
                  {user?.email || 'afonso.moreira@ahmsolution.com'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Sair do sistema"
              className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#DE6464] hover:bg-white/[0.08] transition-colors"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </aside>

      {/* Drawer Mobile (Deslizante 250ms) */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex flex-col w-72 max-w-[85vw] bg-[#030507] text-white p-4 z-50 shadow-2xl transition-transform duration-250 ease-in-out">
            <div className="flex items-center justify-between pb-4 border-b border-[#1A1F26]">
              <Logo variant="light" size="sm" />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-lg text-[#9CA3AF] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false)
                  setIsNewTicketOpen(true)
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white shadow"
                style={{ backgroundColor: '#DE6464' }}
              >
                <PlusCircle className="w-4 h-4" strokeWidth={1.5} />
                <span>Novo Ticket</span>
              </button>
            </div>

            <nav className="flex-1 space-y-1.5 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold ${
                      isActive
                        ? 'text-white bg-[#DE6464]'
                        : 'text-[#9CA3AF] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4" strokeWidth={1.5} />
                    <span>{item.name}</span>
                  </NavLink>
                )
              })}
            </nav>

            <div className="pt-4 border-t border-[#1A1F26]">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">
                    {user?.name || 'Afonso Moreira'}
                  </p>
                  <p className="text-[10px] text-[#9CA3AF] truncate">{user?.email}</p>
                </div>
                <button type="button" onClick={handleLogout} className="p-2 text-[#DE6464]">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Área Principal (Header + Main Content + Footer) */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Superior 64px */}
        <header className="h-16 bg-white border-b border-[#E5E7EB] px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            {/* Hambúrguer Mobile */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-[#030507] hover:bg-[#FAF7F2] transition-colors"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" strokeWidth={1.5} />
            </button>
            <h1 className="text-lg sm:text-xl font-extrabold text-[#030507] tracking-tight">
              {getPageTitle()}
            </h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Notificações com badge pulsante */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Notificações"
                  className="relative p-2.5 rounded-xl border border-[#E5E7EB] bg-white text-[#030507] hover:bg-[#FAF7F2] transition-colors"
                >
                  <Bell className="w-4 h-4 text-[#030507]" strokeWidth={1.5} />
                  {newTicketsCount > 0 && (
                    <span
                      className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center animate-pulse-subtle"
                      style={{ backgroundColor: '#DE6464' }}
                    >
                      {newTicketsCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-80 bg-white p-2 rounded-xl shadow-xl border border-[#E5E7EB]"
              >
                <DropdownMenuLabel className="text-xs font-bold text-[#030507] px-2 py-1.5 flex items-center justify-between">
                  <span>Tickets Recentes (&lt; 24h)</span>
                  <span className="text-[10px] font-normal text-[#6B7280]">
                    {recentNotifications.length} novos
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-64 overflow-y-auto space-y-1 py-1">
                  {recentNotifications.length === 0 ? (
                    <p className="text-xs text-center text-[#6B7280] py-4">
                      Nenhum ticket novo nas últimas 24 horas.
                    </p>
                  ) : (
                    recentNotifications.slice(0, 5).map((n) => (
                      <DropdownMenuItem
                        key={n.id}
                        onClick={() => navigate('/tickets')}
                        className="cursor-pointer p-2 rounded-lg hover:bg-[#FAF7F2] flex flex-col items-start gap-1"
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[11px] font-mono font-bold text-[#DE6464]">
                            {n.ticket_id}
                          </span>
                          <span className="text-[10px] text-[#6B7280]">
                            {new Date(n.created).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-[#030507] truncate w-full">
                          {n.assunto}
                        </p>
                        <p className="text-[10px] text-[#6B7280] truncate w-full">
                          Cliente: {n.cliente}
                        </p>
                      </DropdownMenuItem>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Avatar do Usuário */}
            <div className="flex items-center gap-2 pl-2 border-l border-[#E5E7EB]">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow-sm"
                style={{ backgroundColor: '#030507', border: '1.5px solid #DE6464' }}
              >
                {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-[#030507] leading-tight">
                  {user?.name || 'Afonso Moreira'}
                </p>
                <span className="text-[10px] text-[#10B981] font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" /> Online
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>

        {/* Footer Discreto */}
        <footer className="px-6 py-4 border-t border-[#E5E7EB] bg-white text-right text-xs text-[#9CA3AF] flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-left">
            <span className="font-semibold text-[#030507]">AHM Solution</span> — Suporte Comercial &
            Logística Integrada
          </div>
          <div>© {new Date().getFullYear()} Todos os direitos reservados. v1.0.0</div>
        </footer>
      </div>

      {/* Modal Novo Ticket Global */}
      <Dialog open={isNewTicketOpen} onOpenChange={setIsNewTicketOpen}>
        <DialogContent className="max-w-lg bg-white p-6 rounded-2xl modal-ahm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#030507]">
              Abrir Novo Ticket Comercial
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B7280]">
              Cadastre a solicitação do cliente para triagem e acompanhamento imediato.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateTicketSubmit} className="space-y-4 mt-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1">
                Cliente / Empresa *
              </label>
              <input
                type="text"
                required
                value={newTicketForm.cliente}
                onChange={(e) => setNewTicketForm({ ...newTicketForm, cliente: e.target.value })}
                placeholder="Ex: Indústria Alfa S/A"
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
                value={newTicketForm.assunto}
                onChange={(e) => setNewTicketForm({ ...newTicketForm, assunto: e.target.value })}
                placeholder="Ex: Cotação de frete rodoviário urgente"
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] outline-none focus:border-[#DE6464]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1">
                  Prioridade
                </label>
                <select
                  value={newTicketForm.prioridade}
                  onChange={(e) =>
                    setNewTicketForm({
                      ...newTicketForm,
                      prioridade: e.target.value as TicketPrioridade,
                    })
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
                  Canal de Entrada
                </label>
                <select
                  value={newTicketForm.canal}
                  onChange={(e) =>
                    setNewTicketForm({
                      ...newTicketForm,
                      canal: e.target.value as CanalAtendimento,
                    })
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
                Descrição Detalhada
              </label>
              <textarea
                rows={3}
                value={newTicketForm.descricao}
                onChange={(e) => setNewTicketForm({ ...newTicketForm, descricao: e.target.value })}
                placeholder="Descreva as especificações, rotas, volumes ou detalhes da solicitação..."
                className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] outline-none focus:border-[#DE6464]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsNewTicketOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[#6B7280] hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmittingTicket}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-md disabled:opacity-60"
                style={{ backgroundColor: '#DE6464' }}
              >
                {isSubmittingTicket ? 'Criando ticket...' : 'Criar Ticket'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
