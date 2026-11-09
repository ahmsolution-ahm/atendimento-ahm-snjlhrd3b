import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { produtosService } from '@/services/produtos'
import type { ProdutoRecord, ProdutoStatus } from '@/types'
import { useToast } from '@/hooks/use-toast'
import { Package, RefreshCw, Power, Search, PackageOpen, AlertCircle, Sparkles } from 'lucide-react'

export default function Produtos() {
  const { toast } = useToast()
  const [produtos, setProdutos] = useState<ProdutoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'Todos' | ProdutoStatus>('Todos')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const data = await produtosService.list()
      setProdutos(data)
    } catch (_) {
      toast({
        title: 'Erro ao carregar catálogo',
        description: 'Não foi possível listar os produtos. Tente novamente.',
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
    return produtos.filter((p) => {
      const matchStatus = statusFilter === 'Todos' || p.status === statusFilter
      const term = search.trim().toLowerCase()
      const matchSearch =
        !term ||
        p.nome.toLowerCase().includes(term) ||
        (p.familia || '').toLowerCase().includes(term)
      return matchStatus && matchSearch
    })
  }, [produtos, statusFilter, search])

  const ativosCount = produtos.filter((p) => p.status === 'Ativo').length
  const inativosCount = produtos.length - ativosCount

  const handleToggleStatus = async (produto: ProdutoRecord) => {
    const novoStatus: ProdutoStatus = produto.status === 'Ativo' ? 'Inativo' : 'Ativo'
    setTogglingId(produto.id)
    try {
      const updated = await produtosService.update(produto.id, { status: novoStatus })
      setProdutos((prev) => prev.map((p) => (p.id === produto.id ? updated : p)))
      toast({
        title: novoStatus === 'Ativo' ? 'Produto ativado!' : 'Produto inativado!',
        description:
          novoStatus === 'Ativo'
            ? `"${produto.nome}" voltou a ficar disponível para qualificação.`
            : `"${produto.nome}" saiu da seleção de novos leads, mas o histórico foi preservado.`,
      })
    } catch (err) {
      const msg =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: string }).message)
          : ''
      toast({
        title: 'Erro ao alterar status',
        description:
          msg ||
          'A alteração foi bloqueada pela validação do sistema. Verifique se o produto está completo.',
        variant: 'destructive',
      })
      loadData()
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#DE6464] mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Catálogo Comercial</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#030507]">Catálogo de Produtos</h1>
          <p className="text-xs text-[#6B7280]">
            Produtos disponíveis para qualificação de leads — ative ou inative sem apagar o
            histórico
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#030507] bg-white border border-[#E5E7EB] shadow-sm transition-all hover:bg-[#FAF7F2] flex items-center gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Cards Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] text-[#6B7280] block font-medium uppercase tracking-wider">
                Total de Produtos
              </span>
              <span className="text-2xl font-extrabold text-[#030507]">{produtos.length}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#DE6464]/10 text-[#DE6464] flex items-center justify-center">
              <Package className="w-5 h-5" strokeWidth={1.5} />
            </div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] text-[#6B7280] block font-medium uppercase tracking-wider">
                Ativos
              </span>
              <span className="text-2xl font-extrabold text-[#10B981]">{ativosCount}</span>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 border border-emerald-200 text-[#10B981]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
              Em qualificação
            </span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] text-[#6B7280] block font-medium uppercase tracking-wider">
                Inativos
              </span>
              <span className="text-2xl font-extrabold text-[#6B7280]">{inativosCount}</span>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-100 border border-gray-200 text-[#6B7280]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF]" />
              Fora da seleção
            </span>
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
            placeholder="Buscar por nome ou família..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] bg-white outline-none focus:border-[#DE6464]"
          />
        </div>
        <div className="flex gap-2">
          {(['Todos', 'Ativo', 'Inativo'] as const).map((f) => (
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
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Produtos */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 text-[#DE6464] animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-12 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#FAF7F2] text-[#9CA3AF] flex items-center justify-center mb-4">
            <PackageOpen className="w-7 h-7" strokeWidth={1.5} />
          </div>
          <h2 className="text-sm font-bold text-[#030507] mb-1">
            {produtos.length === 0 ? 'Catálogo vazio' : 'Nenhum produto encontrado'}
          </h2>
          <p className="text-xs text-[#6B7280] max-w-sm">
            {produtos.length === 0
              ? 'Nenhum produto foi cadastrado ainda. Cadastre o primeiro produto para começar a qualificar leads.'
              : 'Nenhum produto corresponde aos filtros aplicados. Ajuste a busca ou o status.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <div
              key={p.id}
              className={`bg-white p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                p.status === 'Inativo' ? 'border-[#E5E7EB] opacity-75' : 'border-[#E5E7EB]'
              }`}
            >
              {/* Informações Principais */}
              <div className="flex items-start gap-4 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: p.status === 'Ativo' ? 'rgba(16, 185, 129, 0.15)' : '#FAF7F2',
                    color: p.status === 'Ativo' ? '#10B981' : '#6B7280',
                  }}
                >
                  <Package className="w-5 h-5" strokeWidth={1.5} />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-xs text-[#DE6464]">
                      {p.familia || 'Sem família'}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#FAF7F2] border border-[#E5E7EB] text-[#030507]">
                      {p.tipo_venda}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#FAF7F2] border border-[#E5E7EB] text-[#030507]">
                      Complexidade {p.complexidade}
                    </span>
                    {p.incompleto === true && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 border border-amber-200 text-[#D97706]">
                        <AlertCircle className="w-3 h-3" />
                        Incompleto
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                        p.status === 'Ativo'
                          ? 'bg-emerald-50 border-emerald-200 text-[#10B981]'
                          : 'bg-gray-100 border-gray-200 text-[#6B7280]'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          p.status === 'Ativo' ? 'bg-[#10B981]' : 'bg-[#9CA3AF]'
                        }`}
                      />
                      {p.status}
                    </span>
                  </div>
                  <h2 className="text-sm font-bold text-[#030507] truncate">{p.nome}</h2>
                  <p className="text-xs text-[#6B7280] truncate">
                    ICP: <strong className="text-[#030507]">{p.icp}</strong>
                    {' · '}Dor: {p.dor}
                  </p>
                  <p className="text-[11px] text-[#9CA3AF] truncate mt-0.5">
                    Especialista:{' '}
                    {p.expand?.especialista?.name ||
                      p.especialista ||
                      '— pendência (sem especialista)'}
                  </p>
                </div>
              </div>

              {/* Ação Ativar/Inativar */}
              <button
                type="button"
                onClick={() => handleToggleStatus(p)}
                disabled={togglingId === p.id}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 self-start md:self-auto shrink-0 ${
                  p.status === 'Ativo'
                    ? 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#FAF7F2]'
                    : 'text-white hover:bg-[#C94F4F]'
                }`}
                style={p.status === 'Ativo' ? undefined : { backgroundColor: '#DE6464' }}
                title={
                  p.status === 'Ativo'
                    ? 'Inativar: o produto sai da seleção de novos leads, mas o histórico é preservado'
                    : 'Ativar: o produto volta a ficar disponível para qualificação'
                }
              >
                {togglingId === p.id ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Power className="w-4 h-4" />
                )}
                <span>{p.status === 'Ativo' ? 'Inativar' : 'Ativar'}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
