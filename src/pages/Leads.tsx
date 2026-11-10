import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { leadsService } from '@/services/leads'
import { produtosService } from '@/services/produtos'
import { useAuth } from '@/contexts/AuthContext'
import type { LeadRecord, LeadStatus, LeadUrgencia, ProdutoRecord } from '@/types'
import type { CsvLeadRow, LinhaInvalida, PreviaImportacao } from '@/lib/csvImport'
import {
  parseCsvFile,
  mapearCabecalhos,
  validarLinhas,
  detectarDuplicadasNoArquivo,
} from '@/lib/csvImport'
import { useToast } from '@/hooks/use-toast'
import {
  Users,
  UserPlus,
  RefreshCw,
  Search,
  Inbox,
  AlertCircle,
  Sparkles,
  FileUp,
  CheckCircle2,
  XCircle,
  Copy,
  ClipboardCheck,
  Info,
} from 'lucide-react'
import { qualificar, justificativa } from '@/lib/qualificacao'
import type { ResultadoQualificacao } from '@/lib/qualificacao'
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
  const [searchAplicada, setSearchAplicada] = useState('')
  const [statusFilter, setStatusFilter] = useState<'Todos' | LeadStatus>('Todos')
  // F1-T09/desempenho: paginação server-side
  const [pagina, setPagina] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [totalLeads, setTotalLeads] = useState(0)
  const [contadores, setContadores] = useState({ total: 0, novos: 0, pendentes: 0 })
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Modal Novo Lead
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // F1-T06 RN-1.5: duplicidade local — aviso antes de confirmar
  const [duplicidade, setDuplicidade] = useState<LeadRecord[] | null>(null)
  const [checandoDuplicidade, setChecandoDuplicidade] = useState(false)
  const [forcarCriacao, setForcarCriacao] = useState(false)
  const dupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const checarDuplicidade = useCallback(async (contato: string, empresa: string) => {
    if (!contato.trim() || !empresa.trim()) {
      setDuplicidade(null)
      setForcarCriacao(false)
      return
    }
    setChecandoDuplicidade(true)
    try {
      const encontrados = await leadsService.buscarDuplicidade(contato, empresa)
      setDuplicidade(encontrados.length > 0 ? encontrados : null)
      setForcarCriacao(false)
    } catch (_) {
      setDuplicidade(null)
    } finally {
      setChecandoDuplicidade(false)
    }
  }, [])

  // debounce: consulta só 600ms depois da última digitação em contato/empresa
  const agendarChecagem = (contato: string, empresa: string) => {
    if (dupTimerRef.current) clearTimeout(dupTimerRef.current)
    dupTimerRef.current = setTimeout(() => checarDuplicidade(contato, empresa), 600)
  }

  // F1-T05: Importação CSV
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importPreview, setImportPreview] = useState<PreviaImportacao | null>(null)
  const [importFileName, setImportFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 })
  const [importResult, setImportResult] = useState<{
    criados: number
    falhas: LinhaInvalida[]
  } | null>(null)

  // F1-T07: motor de qualificação
  const [qualificandoId, setQualificandoId] = useState<string | null>(null)
  const [resultadoQualificacao, setResultadoQualificacao] = useState<{
    lead: LeadRecord
    resultado: ResultadoQualificacao
  } | null>(null)
  const [qualificando, setQualificando] = useState(false)

  // F1-T08: editar lead + reprocessamento + rollback auditável
  const [editLead, setEditLead] = useState<LeadRecord | null>(null)
  const [editForm, setEditForm] = useState({
    dor: '',
    urgencia: 'Média' as LeadUrgencia,
    produto_interesse: '',
    observacoes: '',
    empresa: '',
    contato: '',
  })
  const [savingEdit, setSavingEdit] = useState(false)
  const [rollbackLead, setRollbackLead] = useState<LeadRecord | null>(null)
  const [rollbackMotivo, setRollbackMotivo] = useState('')
  const [savingRollback, setSavingRollback] = useState(false)
  const [verHistorico, setVerHistorico] = useState(false)
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

  // F1-T09/desempenho: carrega UMA página do servidor (20 leads, 1 requisição) + contadores agregados
  const loadData = useCallback(async () => {
    try {
      const filtros: string[] = []
      if (statusFilter !== 'Todos') filtros.push(`status='${statusFilter}'`)
      if (searchAplicada.trim()) {
        const t = searchAplicada.trim().replace(/'/g, "\\'")
        filtros.push(`(nome~'${t}' || empresa~'${t}' || contato~'${t}')`)
      }
      const filtro = filtros.length > 0 ? filtros.join(' && ') : undefined
      const [lPage, pList, conts] = await Promise.all([
        leadsService.listPaginado(pagina, 20, filtro),
        produtosService.listAtivos(),
        leadsService.contadores(),
      ])
      setLeads(lPage.itens)
      setTotalPaginas(lPage.totalPaginas)
      setTotalLeads(lPage.total)
      setProdutos(pList)
      setContadores(conts)
    } catch (_) {
      toast({
        title: 'Erro ao carregar leads',
        description: 'Não foi possível listar os leads. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast, pagina, statusFilter, searchAplicada])

  useEffect(() => {
    loadData()
  }, [loadData])

  // busca server-side com debounce (600ms após parar de digitar)
  const onSearchChange = (v: string) => {
    setSearch(v)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setSearchAplicada(v)
      setPagina(1)
    }, 600)
  }

  const mudarStatus = (f: 'Todos' | LeadStatus) => {
    setStatusFilter(f)
    setPagina(1)
  }

  const novosCount = contadores.novos
  const pendentesCount = contadores.pendentes

  // F1-T05: analisar arquivo e montar prévia (nada é gravado ainda)
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportResult(null)
    try {
      const buffer = await file.arrayBuffer()
      const { cabecalhos, rows } = parseCsvFile(buffer)
      const mapa = mapearCabecalhos(cabecalhos)
      const camposMapeados = mapa.filter(Boolean).length
      if (camposMapeados === 0) {
        toast({
          title: 'Cabeçalhos não reconhecidos',
          description:
            'O arquivo precisa ter colunas reconhecíveis como Nome, Empresa e Contato/Email. Verifique a primeira linha.',
          variant: 'destructive',
        })
        return
      }
      const temContato = mapa.includes('contato')
      if (!temContato) {
        toast({
          title: 'Coluna de contato ausente',
          description:
            'Não encontrei uma coluna de e-mail/contato no arquivo. Adicione a coluna e tente novamente.',
          variant: 'destructive',
        })
        return
      }
      const { validas, invalidas } = validarLinhas(rows, mapa)
      const duplicadasNoArquivo = detectarDuplicadasNoArquivo(validas)
      // duplicidades na base: compara contato+empresa dos leads existentes
      const chavesBase = new Set(
        leads.map((l) => `${(l.contato || '').toLowerCase()}|${(l.empresa || '').toLowerCase()}`),
      )
      const duplicadasNaBase = validas.filter((l) =>
        chavesBase.has(`${l.contato.toLowerCase()}|${l.empresa.toLowerCase()}`),
      )
      setImportFileName(file.name)
      setImportPreview({
        total: rows.length,
        validas,
        invalidas,
        duplicadasNoArquivo,
        duplicadasNaBase,
        cabecalhos,
      })
    } catch (err) {
      toast({
        title: 'Arquivo ilegível',
        description:
          err instanceof Error
            ? err.message
            : 'Não foi possível ler o arquivo. Verifique o formato (CSV ou TSV).',
        variant: 'destructive',
      })
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // F1-T05: confirmar importação — grava só as válidas
  const handleConfirmImport = async () => {
    if (!importPreview) return
    setImporting(true)
    setImportProgress({ done: 0, total: importPreview.validas.length })
    try {
      const produtoPorNome = new Map(produtos.map((p) => [p.nome.toLowerCase(), p.id]))
      const result = await leadsService.importarLote(
        importPreview.validas,
        produtoPorNome,
        user?.id,
        (done, total) => setImportProgress({ done, total }),
      )
      setImportResult(result)
      setImportPreview(null)
      loadData()
      toast({
        title: 'Importação concluída',
        description: `${result.criados} leads criados${result.falhas.length ? `, ${result.falhas.length} falharam` : ''}.`,
      })
    } catch (err) {
      toast({
        title: 'Erro na importação',
        description: err instanceof Error ? err.message : 'Falha ao gravar os leads.',
        variant: 'destructive',
      })
    } finally {
      setImporting(false)
    }
  }

  // F1-T07: executar o motor de qualificação no lead e gravar o resultado
  const handleQualificar = async (lead: LeadRecord) => {
    setQualificandoId(lead.id)
    setQualificando(true)
    try {
      const produto = lead.expand?.produto_interesse
        ? {
            id: lead.expand.produto_interesse.id,
            nome: lead.expand.produto_interesse.nome,
            status: lead.expand.produto_interesse.status,
            complexidade: lead.expand.produto_interesse.complexidade,
            familia_tecnologica: lead.expand.produto_interesse.familia_tecnologica,
          }
        : null
      const resultado = qualificar(lead, produto)
      const just = justificativa(resultado)
      await leadsService.gravarQualificacao(lead.id, resultado, just, user?.id, lead)
      setResultadoQualificacao({ lead, resultado })
      loadData()
    } catch (err) {
      toast({
        title: 'Erro ao qualificar',
        description: err instanceof Error ? err.message : 'Falha ao gravar a qualificação.',
        variant: 'destructive',
      })
    } finally {
      setQualificando(false)
      setQualificandoId(null)
    }
  }

  // F1-T08: abrir modal de edição com os dados atuais do lead
  const abrirEdicao = (lead: LeadRecord) => {
    setEditLead(lead)
    setEditForm({
      dor: lead.dor || '',
      urgencia: (lead.urgencia || 'Média') as LeadUrgencia,
      produto_interesse: lead.produto_interesse || '',
      observacoes: lead.observacoes || '',
      empresa: lead.empresa || '',
      contato: lead.contato || '',
    })
  }

  // F1-T08: salvar edição e requalificar (o hook anexa o resultado anterior ao histórico)
  const handleSalvarEdicao = async (requalificar: boolean) => {
    if (!editLead) return
    setSavingEdit(true)
    try {
      // IMPORTANTE: enviar string vazia explicitamente para LIMPAR campos (dor/produto)
      // — 'undefined' no SDK do PocketBase não envia o campo e o valor antigo permanece
      // (bug encontrado no teste humano: apagar a dor não surtia efeito)
      await leadsService.update(editLead.id, {
        dor: editForm.dor,
        urgencia: editForm.urgencia,
        produto_interesse: editForm.produto_interesse,
        observacoes: editForm.observacoes,
        empresa: editForm.empresa,
        contato: editForm.contato,
      })
      setEditLead(null)
      if (requalificar) {
        const atualizada = await leadsService.getById(editLead.id)
        const produto = atualizada.expand?.produto_interesse
          ? {
              id: atualizada.expand.produto_interesse.id,
              nome: atualizada.expand.produto_interesse.nome,
              status: atualizada.expand.produto_interesse.status,
              complexidade: atualizada.expand.produto_interesse.complexidade,
              familia_tecnologica: atualizada.expand.produto_interesse.familia_tecnologica,
            }
          : null
        const resultado = qualificar(atualizada, produto)
        const just = justificativa(resultado)
        await leadsService.gravarQualificacao(editLead.id, resultado, just, user?.id, atualizada)
        setResultadoQualificacao({ lead: atualizada, resultado })
      }
      loadData()
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: err instanceof Error ? err.message : 'Falha ao atualizar o lead.',
        variant: 'destructive',
      })
    } finally {
      setSavingEdit(false)
    }
  }

  // F1-T08: rollback auditável — volta para pendente com motivo obrigatório
  const handleRollback = async () => {
    if (!rollbackLead || !rollbackMotivo.trim()) return
    setSavingRollback(true)
    try {
      await leadsService.voltarPendente(
        rollbackLead.id,
        rollbackMotivo.trim(),
        user?.email,
        rollbackLead,
      )
      toast({
        title: 'Lead devolvido para pendente',
        description: 'O motivo foi registrado no histórico da qualificação.',
      })
      setRollbackLead(null)
      setRollbackMotivo('')
      loadData()
    } catch (err) {
      toast({
        title: 'Erro no rollback',
        description: err instanceof Error ? err.message : 'Falha ao devolver o lead.',
        variant: 'destructive',
      })
    } finally {
      setSavingRollback(false)
    }
  }

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault()
    // RN-1.5: se há duplicidade e o usuário ainda não confirmou, mostra o aviso (não cria)
    if (duplicidade && !forcarCriacao) {
      toast({
        title: 'Possível duplicidade',
        description:
          'Revise o aviso no formulário. Para criar mesmo assim, clique em "Criar mesmo assim".',
        variant: 'destructive',
      })
      return
    }
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
        title: duplicidade ? 'Lead criado (duplicidade confirmada)!' : 'Lead criado!',
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
      setDuplicidade(null)
      setForcarCriacao(false)
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
        <div className="flex gap-2 self-start sm:self-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={handleFileSelected}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#030507] bg-white border border-[#E5E7EB] shadow-sm transition-all hover:bg-[#FAF7F2] flex items-center gap-2"
          >
            <FileUp className="w-4 h-4" />
            <span>Importar CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setIsNewModalOpen(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white shadow-md transition-all hover:bg-[#C94F4F] flex items-center gap-2"
            style={{ backgroundColor: '#DE6464' }}
          >
            <UserPlus className="w-4 h-4" />
            <span>Novo Lead</span>
          </button>
        </div>
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
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nome, empresa ou contato..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] bg-white outline-none focus:border-[#DE6464]"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['Todos', 'novo', 'pendente', 'qualificado'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => mudarStatus(f)}
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
          {leads.map((l) => (
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
                  {l.qualificacao_resultado && (
                    <p className="text-[11px] text-[#6B7280] mt-1 line-clamp-2">
                      <Info className="w-3 h-3 inline mr-1 -mt-0.5" />
                      {l.qualificacao_resultado}
                    </p>
                  )}
                </div>
              </div>
              <div className="shrink-0 flex gap-1.5">
                {/* ações por lead — a lista é paginada; após ação, loadData() recarrega só a página atual */}
                <button
                  type="button"
                  onClick={() => abrirEdicao(l)}
                  className="px-3 py-2 rounded-xl text-[11px] font-semibold text-[#030507] bg-white border border-[#E5E7EB] shadow-sm hover:bg-[#FAF7F2] flex items-center gap-1.5"
                  title="Editar dados que afetam a qualificação"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleQualificar(l)}
                  disabled={qualificando || qualificandoId === l.id}
                  className="px-3 py-2 rounded-xl text-[11px] font-semibold text-[#030507] bg-white border border-[#E5E7EB] shadow-sm hover:bg-[#FAF7F2] disabled:opacity-50 flex items-center gap-1.5"
                  title="Executar motor de qualificação (SPEC 1.3)"
                >
                  {qualificandoId === l.id ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ClipboardCheck className="w-3.5 h-3.5" />
                  )}
                  Qualificar
                </button>
                {l.status === 'qualificado' && (
                  <button
                    type="button"
                    onClick={() => setRollbackLead(l)}
                    className="px-3 py-2 rounded-xl text-[11px] font-semibold text-[#92400E] bg-amber-50 border border-amber-200 hover:bg-amber-100 flex items-center gap-1.5"
                    title="Voltar para pendente com motivo (rollback auditável)"
                  >
                    Devolver
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Paginação server-side (F1-T09/desempenho) */}
      {!loading && totalPaginas > 1 && (
        <div className="flex items-center justify-between bg-white px-5 py-3 rounded-2xl border border-[#E5E7EB] shadow-sm">
          <span className="text-[11px] text-[#6B7280]">
            {totalLeads.toLocaleString('pt-BR')} leads · página {pagina} de{' '}
            {totalPaginas.toLocaleString('pt-BR')}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPagina(1)}
              disabled={pagina === 1}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-[#E5E7EB] disabled:opacity-40 hover:bg-[#FAF7F2]"
            >
              «
            </button>
            <button
              type="button"
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={pagina === 1}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-[#E5E7EB] disabled:opacity-40 hover:bg-[#FAF7F2]"
            >
              Anterior
            </button>
            <span
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white"
              style={{ backgroundColor: '#DE6464' }}
            >
              {pagina}
            </span>
            <button
              type="button"
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              disabled={pagina >= totalPaginas}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-[#E5E7EB] disabled:opacity-40 hover:bg-[#FAF7F2]"
            >
              Próxima
            </button>
            <button
              type="button"
              onClick={() => setPagina(totalPaginas)}
              disabled={pagina >= totalPaginas}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-[#E5E7EB] disabled:opacity-40 hover:bg-[#FAF7F2]"
            >
              »
            </button>
          </div>
        </div>
      )}

      {/* Modal Editar Lead (F1-T08) */}
      <Dialog open={!!editLead} onOpenChange={(open) => !open && setEditLead(null)}>
        <DialogContent className="max-w-lg bg-white p-6 rounded-2xl modal-ahm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#030507]">Editar Lead</DialogTitle>
            <DialogDescription className="text-xs text-[#6B7280]">
              {editLead?.nome} — corrija os dados e escolha se quer requalificar em seguida. O
              resultado anterior fica no histórico.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1">
                  Empresa
                </label>
                <input
                  type="text"
                  value={editForm.empresa}
                  onChange={(e) => setEditForm({ ...editForm, empresa: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] outline-none focus:border-[#DE6464]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1">
                  Contato
                </label>
                <input
                  type="text"
                  value={editForm.contato}
                  onChange={(e) => setEditForm({ ...editForm, contato: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] outline-none focus:border-[#DE6464]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1">
                Produto de interesse
              </label>
              <select
                value={editForm.produto_interesse}
                onChange={(e) => setEditForm({ ...editForm, produto_interesse: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] bg-white outline-none focus:border-[#DE6464]"
              >
                <option value="">— sem produto (lead fica pendente)</option>
                {/* F1-T09: incluir o produto ATUAL do lead mesmo se inativo (marcado), para o
                    usuário ver e trocar — esconderia informação e impediria o caminho de recuperação */}
                {(() => {
                  const atual = editLead?.expand?.produto_interesse
                  const atualInativo = atual && atual.status !== 'Ativo'
                  const jaListado = produtos.some((p) => p.id === atual?.id)
                  return atualInativo && !jaListado ? (
                    <option key={atual.id} value={atual.id}>
                      {atual.nome} (inativo)
                    </option>
                  ) : null
                })()}
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1">
                Dor / Necessidade
              </label>
              <input
                type="text"
                value={editForm.dor}
                onChange={(e) => setEditForm({ ...editForm, dor: e.target.value })}
                placeholder="Ex.: Avarias em transporte de carga sensível"
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] outline-none focus:border-[#DE6464]"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1">
                  Urgência
                </label>
                <select
                  value={editForm.urgencia}
                  onChange={(e) =>
                    setEditForm({ ...editForm, urgencia: e.target.value as LeadUrgencia })
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] bg-white outline-none focus:border-[#DE6464]"
                >
                  <option value="Baixa">Baixa</option>
                  <option value="Média">Média</option>
                  <option value="Alta">Alta</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1">
                  Observações
                </label>
                <input
                  type="text"
                  value={editForm.observacoes}
                  onChange={(e) => setEditForm({ ...editForm, observacoes: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] outline-none focus:border-[#DE6464]"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setEditLead(null)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[#6B7280]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => handleSalvarEdicao(false)}
              disabled={savingEdit}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#030507] bg-white border border-[#E5E7EB] shadow-sm hover:bg-[#FAF7F2] disabled:opacity-50"
            >
              {savingEdit ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={() => handleSalvarEdicao(true)}
              disabled={savingEdit}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-md disabled:opacity-50"
              style={{ backgroundColor: '#DE6464' }}
            >
              {savingEdit ? 'Processando...' : 'Salvar e Requalificar'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Rollback auditável (F1-T08) */}
      <Dialog open={!!rollbackLead} onOpenChange={(open) => !open && setRollbackLead(null)}>
        <DialogContent className="max-w-md bg-white p-6 rounded-2xl modal-ahm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#030507]">
              Devolver para pendente
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B7280]">
              {rollbackLead?.nome} — {rollbackLead?.empresa}. O motivo é registrado no histórico da
              qualificação (SPEC 1.3: rollback auditável).
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1">
              Motivo (obrigatório)
            </label>
            <textarea
              rows={3}
              value={rollbackMotivo}
              onChange={(e) => setRollbackMotivo(e.target.value)}
              placeholder="Ex.: produto errado selecionado; cliente informou outra necessidade"
              className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] outline-none focus:border-[#DE6464]"
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setRollbackLead(null)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[#6B7280]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleRollback}
              disabled={savingRollback || !rollbackMotivo.trim()}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-md disabled:opacity-50"
              style={{ backgroundColor: '#DE6464' }}
            >
              {savingRollback ? 'Devolvendo...' : 'Devolver com motivo'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal resultado da qualificação (F1-T07 + histórico F1-T08) */}
      <Dialog
        open={!!resultadoQualificacao}
        onOpenChange={(open) => !open && setResultadoQualificacao(null)}
      >
        <DialogContent className="max-w-md bg-white p-6 rounded-2xl modal-ahm">
          <DialogHeader>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${
                resultadoQualificacao?.resultado.status === 'qualificado'
                  ? 'bg-emerald-50 text-[#059669]'
                  : resultadoQualificacao?.resultado.status === 'pendente'
                    ? 'bg-orange-50 text-[#C2410C]'
                    : 'bg-gray-100 text-[#6B7280]'
              }`}
            >
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-[#030507]">
              Resultado: {resultadoQualificacao?.resultado.status}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B7280]">
              {resultadoQualificacao?.lead.nome} — {resultadoQualificacao?.lead.empresa}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#030507] mb-1.5">
              Justificativa
            </h4>
            <ul className="space-y-1">
              {resultadoQualificacao?.resultado.motivos.map((m, i) => (
                <li key={i} className="text-[11px] text-[#030507] flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#059669] shrink-0 mt-0.5" />
                  {m}
                </li>
              ))}
            </ul>
            {resultadoQualificacao?.resultado.pendencias.length ? (
              <>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#030507] mt-3 mb-1.5">
                  Pendências
                </h4>
                <ul className="space-y-1">
                  {resultadoQualificacao.resultado.pendencias.map((p, i) => (
                    <li key={i} className="text-[11px] text-[#C2410C] flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      {p}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {/* F1-T08: histórico de reprocessamentos */}
            {(() => {
              let hist: { em: string; por: string; status: string; resultado: string }[] = []
              try {
                const raw = resultadoQualificacao?.lead.qualificacao_historico
                if (raw) hist = JSON.parse(raw)
              } catch (_) {
                hist = []
              }
              if (hist.length === 0) return null
              return (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setVerHistorico(!verHistorico)}
                    className="text-[11px] font-semibold text-[#DE6464] flex items-center gap-1"
                  >
                    <Info className="w-3.5 h-3.5" />
                    {verHistorico
                      ? 'Ocultar histórico'
                      : `Ver histórico (${hist.length} processamento${hist.length > 1 ? 's' : ''} anterior${hist.length > 1 ? 'es' : ''})`}
                  </button>
                  {verHistorico && (
                    <ul className="mt-2 space-y-2 border-l-2 border-[#E5E7EB] pl-3">
                      {hist.map((h, i) => (
                        <li key={i} className="text-[11px]">
                          <span className="font-semibold text-[#030507]">{h.status}</span>
                          {h.em && (
                            <span className="text-[#9CA3AF]">
                              {' '}
                              · {new Date(h.em).toLocaleString('pt-BR')}
                            </span>
                          )}
                          <p className="text-[#6B7280] mt-0.5">{h.resultado}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })()}
          </div>

          <div className="flex items-center justify-end pt-4">
            <button
              type="button"
              onClick={() => setResultadoQualificacao(null)}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-md"
              style={{ backgroundColor: '#DE6464' }}
            >
              Fechar
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Importação CSV — prévia (F1-T05) */}
      <Dialog open={!!importPreview} onOpenChange={(open) => !open && setImportPreview(null)}>
        <DialogContent className="max-w-2xl bg-white p-6 rounded-2xl modal-ahm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
              <FileUp className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-[#030507]">
              Prévia da importação — {importFileName}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B7280]">
              Nada foi gravado ainda. Confirme abaixo para criar os leads válidos.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E5E7EB] text-center">
              <div className="text-lg font-extrabold text-[#030507]">{importPreview?.total}</div>
              <div className="text-[10px] uppercase tracking-wider text-[#6B7280] font-semibold">
                Linhas lidas
              </div>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
              <div className="text-lg font-extrabold text-[#059669]">
                {importPreview?.validas.length}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-[#059669] font-semibold">
                Válidas
              </div>
            </div>
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-center">
              <div className="text-lg font-extrabold text-[#DC2626]">
                {importPreview?.invalidas.length}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-[#DC2626] font-semibold">
                Inválidas
              </div>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-center">
              <div className="text-lg font-extrabold text-[#D97706]">
                {(importPreview?.duplicadasNoArquivo.length || 0) +
                  (importPreview?.duplicadasNaBase.length || 0)}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-[#D97706] font-semibold">
                Duplicadas
              </div>
            </div>
          </div>

          {importPreview && importPreview.invalidas.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-bold text-[#030507] mb-2 flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-[#DC2626]" /> Linhas inválidas (
                {importPreview.invalidas.length})
              </h4>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-[#E5E7EB]">
                <table className="w-full text-[11px]">
                  <thead className="bg-[#FAF7F2] sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-[#6B7280]">Linha</th>
                      <th className="text-left px-3 py-2 font-semibold text-[#6B7280]">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.invalidas.slice(0, 100).map((l) => (
                      <tr key={l.linha} className="border-t border-[#E5E7EB]">
                        <td className="px-3 py-1.5 text-[#6B7280]">{l.linha}</td>
                        <td className="px-3 py-1.5 text-[#030507]">{l.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {importPreview.invalidas.length > 100 && (
                <p className="text-[10px] text-[#9CA3AF] mt-1">
                  Mostrando as primeiras 100 de {importPreview.invalidas.length}.
                </p>
              )}
            </div>
          )}

          {importPreview &&
            (importPreview.duplicadasNoArquivo.length > 0 ||
              importPreview.duplicadasNaBase.length > 0) && (
              <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-[#92400E] flex items-start gap-2">
                <Copy className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <div>
                  <strong>Possíveis duplicidades:</strong>{' '}
                  {importPreview.duplicadasNaBase.length > 0 &&
                    `${importPreview.duplicadasNaBase.length} já existem na base (mesmo contato+empresa)`}
                  {importPreview.duplicadasNaBase.length > 0 &&
                    importPreview.duplicadasNoArquivo.length > 0 &&
                    ' · '}
                  {importPreview.duplicadasNoArquivo.length > 0 &&
                    `${importPreview.duplicadasNoArquivo.length} repetidas dentro do próprio arquivo`}
                  . Elas serão criadas mesmo assim — revise a lista se necessário.
                </div>
              </div>
            )}

          {importPreview &&
            importPreview.validas.some((l) => !(l.nome && l.empresa && l.contato)) && (
              <div className="mt-3 p-3 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-[#1E40AF] flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <div>
                  <strong>Leads parciais:</strong> linhas sem nome, empresa ou contato completos
                  entram como <strong>rascunho (pendente)</strong> — você pode completá-las depois
                  na tela de leads.
                </div>
              </div>
            )}

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setImportPreview(null)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[#6B7280]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={importing || !importPreview || importPreview.validas.length === 0}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-md disabled:opacity-50"
              style={{ backgroundColor: '#DE6464' }}
            >
              {importing
                ? `Importando... ${importProgress.done}/${importProgress.total}`
                : `Confirmar importação (${importPreview?.validas.length || 0} leads)`}
            </button>
          </div>
        </DialogContent>
      </Dialog>

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
                  onChange={(e) => {
                    const v = e.target.value
                    setForm({ ...form, empresa: v })
                    agendarChecagem(form.contato, v)
                  }}
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
                  onChange={(e) => {
                    const v = e.target.value
                    setForm({ ...form, contato: v })
                    agendarChecagem(v, form.empresa)
                  }}
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

            {/* F1-T06 RN-1.5: aviso de duplicidade antes de confirmar */}
            {checandoDuplicidade && (
              <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E5E7EB] text-[11px] text-[#6B7280] flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Verificando duplicidades na base...
              </div>
            )}
            {!checandoDuplicidade && duplicidade && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-[#92400E] flex items-start gap-2">
                <Copy className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <strong>Possível duplicidade:</strong> já existe(m) {duplicidade.length} lead(s)
                  com este contato + empresa:
                  <ul className="mt-1 space-y-0.5">
                    {duplicidade.slice(0, 3).map((d) => (
                      <li key={d.id} className="font-medium">
                        • {d.nome || '(sem nome)'} — {d.empresa || '(sem empresa)'} ({d.status}
                        {d.created
                          ? `, criado em ${new Date(d.created).toLocaleDateString('pt-BR')}`
                          : ''}
                        )
                      </li>
                    ))}
                  </ul>
                  <span className="block mt-1">
                    Revise se é o mesmo contato. Se for um caso diferente (ex.: outro contato na
                    mesma empresa), você pode criar mesmo assim.
                  </span>
                </div>
              </div>
            )}

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
              {duplicidade && !forcarCriacao ? (
                <>
                  <button
                    type="button"
                    onClick={() => setForcarCriacao(true)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-[#92400E] bg-amber-50 border border-amber-200 hover:bg-amber-100"
                  >
                    Criar mesmo assim
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForm({ ...form, nome: '', contato: '' })
                      setDuplicidade(null)
                      setForcarCriacao(false)
                    }}
                    className="px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-md"
                    style={{ backgroundColor: '#DE6464' }}
                  >
                    Corrigir dados
                  </button>
                </>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting || !form.nome || !form.empresa || !form.contato}
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-md disabled:opacity-50"
                  style={{ backgroundColor: '#DE6464' }}
                >
                  {isSubmitting ? 'Criando lead...' : 'Criar Lead'}
                </button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
