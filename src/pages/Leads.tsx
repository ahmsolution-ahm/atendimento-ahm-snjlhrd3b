import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { leadsService } from '@/services/leads'
import { produtosService } from '@/services/produtos'
import { useAuth } from '@/contexts/AuthContext'
import type { LeadRecord, LeadStatus, LeadUrgencia, ProdutoRecord } from '@/types'
import { useToast } from '@/hooks/use-toast'
import { Users, UserPlus, RefreshCw, Search, Inbox, AlertCircle, Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

const STATUS_LABELS: Record<LeadStatus, string> = {
  novo: 'Novo',
  'em qualificação': 'Em qualificação',
  qualificado: 'Qualificado',
  pendente: 'Pendente',
  'fora do recorte': 'Fora do recorte',
  transbordo: 'Transbordo',
}

function StatusLeadBadge({ status }: { status: LeadStatus }) {
  const styles: Record<LeadStatus, string> = {
    novo: 'bg-blue-50 border-blue-200 text-blue-700',
    'em qualificação': 'bg-amber-50 border-amber-200 text-[#D97706]',
    qualificado: 'bg-emerald-50 border-emerald-200 text-[#059669]',
    pendente: 'bg-orange-50 border-orange-200 text-[#C2410C]',
    'fora do recorte': 'bg-gray-100 border-gray-200 text-[#6B7280]',
    transbordo: 'bg-purple-50 border-purple-200 text-[#7C3AED]',
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${styles[status] || styles.novo}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status] || status}
    </span>
  )
}

export default function Leads() {
  const { toast } = useToast()
  const { user } = useAuth()
  const [leads, setLeads] = useState<LeadRecord[]>([])
  const [produtos, setProdutos] = useState<ProdutoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'Todos' | LeadStatus>('Todos')

  // Modal Novo Lead
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    nome: '',
    empresa: '',
    contato: '',
    origem: '',
    produto_interesse: '',
    dor: '',
    urgencia: 'Média' as LeadUrgencia,
    observacoes: '',
  })

  const loadData = useCallback(async () => {
    try {
      const [lList, pList] = await Promise.all([leadsService.list(), produtosService.listAtivos()])
      setLeads(lList)
      setProdutos(pList)
    } catch (_) {
      toast({
        title: 'Erro ao carregar leads',
        description: 'Não foi possível listar os leads. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      const matchStatus = statusFilter === 'Todos' || l.status === statusFilter
      const term = search.trim().toLowerCase()
      const matchSearch =
        !term || l.nome.toLowerCase().includes(term) || l.empresa.toLowerCase().includes(term)
      return matchStatus && matchSearch
    })
  }, [leads, statusFilter, search])

  const novosCount = leads.filter((l) => l.status === 'novo').length
  const pendentesCount = leads.filter((l) => l.status === 'pendente').length

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await leadsService.create({
        nome: form.nome,
        empresa: form.empresa,
        contato: form.contato,
        origem: form.origem || undefined,
        produto_interesse: form.produto_interesse || undefined,
        dor: form.dor || undefined,
        urgencia: form.urgencia,
        observacoes: form.observacoes || undefined,
        responsavel: user?.id,
        status: 'novo',
      })
      toast({
        title: 'Lead criado!',
        description: `"${form.nome}" entrou na fila com status novo.`,
      })
      setIsNewModalOpen(false)
      setForm({
        nome: '',
        empresa: '',
        contato: '',
        origem: '',
        produto_interesse: '',
        dor: '',
        urgencia: 'Média',
        observacoes: '',
      })
      loadData()
    } catch (err) {
      const msg =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: string }).message)
          : ''
      toast({
        title: 'Erro ao criar lead',
        description: msg || 'Verifique os campos obrigatórios (nome, empresa e contato).',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#DE6464] mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Prospecção & Qualificação</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#030507]">Gestão de Leads</h1>
          <p className="text-xs text-[#6B7280]">
            Leads cadastrados manualmente entram na fila com status novo para qualificação
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsNewModalOpen(true)}
          className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white shadow-md transition-all hover:bg-[#C94F4F] flex items-center gap-2 self-start sm:self-auto"
          style={{ backgroundColor: '#DE6464' }}
        >
          <UserPlus className="w-4 h-4" />
          <span>Novo Lead</span>
        </button>
      </div>

      {/* Cards Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] text-[#6B7280] block font-medium uppercase tracking-wider">
                Total de Leads
              </span>
              <span className="text-2xl font-extrabold text-[#030507]">{leads.length}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#DE6464]/10 text-[#DE6464] flex items-center justify-center">
              <Users className="w-5 h-5" strokeWidth={1.5} />
            </div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] text-[#6B7280] block font-medium uppercase tracking-wider">
                Novos
              </span>
              <span className="text-2xl font-extrabold text-blue-600">{novosCount}</span>
            </div>
            <StatusLeadBadge status="novo" />
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] text-[#6B7280] block font-medium uppercase tracking-wider">
                Pendentes (sem produto)
              </span>
              <span className="text-2xl font-extrabold text-[#C2410C]">{pendentesCount}</span>
            </div>
            <StatusLeadBadge status="pendente" />
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou empresa..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] bg-white outline-none focus:border-[#DE6464]"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['Todos', 'novo', 'pendente', 'qualificado'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                statusFilter === f
                  ? 'bg-[#030507] text-white border-[#030507] shadow-sm'
                  : 'bg-white text-[#6B7280] border-[#E5E7EB] hover:bg-[#FAF7F2]'
              }`}
            >
              {f === 'Todos' ? 'Todos' : STATUS_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Leads */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 text-[#DE6464] animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-12 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#FAF7F2] text-[#9CA3AF] flex items-center justify-center mb-4">
            <Inbox className="w-7 h-7" strokeWidth={1.5} />
          </div>
          <h2 className="text-sm font-bold text-[#030507] mb-1">
            {leads.length === 0 ? 'Nenhum lead cadastrado' : 'Nenhum lead encontrado'}
          </h2>
          <p className="text-xs text-[#6B7280] max-w-sm">
            {leads.length === 0
              ? 'Cadastre o primeiro lead com o botão "Novo Lead" para começar a fila de qualificação.'
              : 'Nenhum lead corresponde aos filtros aplicados. Ajuste a busca ou o status.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((l) => (
            <div
              key={l.id}
              className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-4 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: 'rgba(222, 100, 100, 0.1)',
                    color: '#DE6464',
                  }}
                >
                  <Users className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <StatusLeadBadge status={l.status} />
                    {l.urgencia && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#FAF7F2] border border-[#E5E7EB] text-[#030507]">
                        Urgência {l.urgencia}
                      </span>
                    )}
                    {l.incompleto === true && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 border border-amber-200 text-[#D97706]">
                        <AlertCircle className="w-3 h-3" />
                        Rascunho
                      </span>
                    )}
                  </div>
                  <h2 className="text-sm font-bold text-[#030507] truncate">{l.nome}</h2>
                  <p className="text-xs text-[#6B7280] truncate">
                    {l.empresa} · Contato: {l.contato}
                  </p>
                  <p className="text-[11px] text-[#9CA3AF] truncate mt-0.5">
                    Produto:{' '}
                    {l.expand?.produto_interesse?.nome || '— pendente (sem produto de interesse)'}
                    {l.origem ? ` · Origem: ${l.origem}` : ''}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Novo Lead */}
      <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
        <DialogContent className="max-w-lg bg-white p-6 rounded-2xl modal-ahm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="w-10 h-10 rounded-xl bg-[#DE6464]/10 text-[#DE6464] flex items-center justify-center mb-2">
              <UserPlus className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-[#030507]">Novo Lead</DialogTitle>
            <DialogDescription className="text-xs text-[#6B7280]">
              Cadastro manual de lead — nome, empresa e contato são obrigatórios (RN-1.4). Sem
              produto de interesse, o lead entra como pendente (RN-1.6).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateLead} className="space-y-4 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  required
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Nome do contato"
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] outline-none focus:border-[#DE6464]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1">
                  Empresa *
                </label>
                <input
                  type="text"
                  required
                  value={form.empresa}
                  onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                  placeholder="Empresa do lead"
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] outline-none focus:border-[#DE6464]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1">
                  Contato *
                </label>
                <input
                  type="text"
                  required
                  value={form.contato}
                  onChange={(e) => setForm({ ...form, contato: e.target.value })}
                  placeholder="Telefone ou e-mail"
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] outline-none focus:border-[#DE6464]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1">
                  Origem
                </label>
                <input
                  type="text"
                  value={form.origem}
                  onChange={(e) => setForm({ ...form, origem: e.target.value })}
                  placeholder="Ex.: Indicação, Site, Evento"
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] outline-none focus:border-[#DE6464]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1">
                  Produto de interesse
                </label>
                <select
                  value={form.produto_interesse}
                  onChange={(e) => setForm({ ...form, produto_interesse: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] bg-white outline-none focus:border-[#DE6464]"
                >
                  <option value="">— sem produto (lead fica pendente)</option>
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1">
                  Urgência
                </label>
                <select
                  value={form.urgencia}
                  onChange={(e) => setForm({ ...form, urgencia: e.target.value as LeadUrgencia })}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] bg-white outline-none focus:border-[#DE6464]"
                >
                  <option value="Baixa">Baixa</option>
                  <option value="Média">Média</option>
                  <option value="Alta">Alta</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1">
                Dor / Necessidade
              </label>
              <input
                type="text"
                value={form.dor}
                onChange={(e) => setForm({ ...form, dor: e.target.value })}
                placeholder="Ex.: Avarias em transporte de carga sensível"
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] outline-none focus:border-[#DE6464]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1">
                Observações
              </label>
              <textarea
                rows={3}
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                placeholder="Contexto adicional do lead"
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] outline-none focus:border-[#DE6464]"
              />
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
                disabled={isSubmitting || !form.nome || !form.empresa || !form.contato}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-md disabled:opacity-50"
                style={{ backgroundColor: '#DE6464' }}
              >
                {isSubmitting ? 'Criando lead...' : 'Criar Lead'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
