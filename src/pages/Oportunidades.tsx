import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Target } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { oportunidadesService, type OportunidadesContadores } from '@/services/oportunidades'
import { formatarValor } from '@/lib/pipeline'
import type { OportunidadeRecord } from '@/types'

// Fila de oportunidades (paginada no servidor, 20 por página). Bloco B: cada oportunidade abre
// na própria página (/oportunidades/:id), em tela inteira — decisão, pipeline, checklist,
// fechamento e resultado ficam lá.

const POR_PAGINA = 20

const statusBadge = (status: OportunidadeRecord['status']) => {
  const base = 'text-sm px-2.5 py-0.5'
  switch (status) {
    case 'Aprovada':
      return (
        <Badge className={`${base} bg-green-100 text-green-800 hover:bg-green-100`}>Aprovada</Badge>
      )
    case 'Rejeitada':
      return <Badge className={`${base} bg-red-100 text-red-800 hover:bg-red-100`}>Rejeitada</Badge>
    case 'Em revisão':
      return (
        <Badge className={`${base} bg-blue-100 text-blue-800 hover:bg-blue-100`}>Em revisão</Badge>
      )
    default:
      return (
        <Badge className={`${base} bg-amber-100 text-amber-800 hover:bg-amber-100`}>Sugerida</Badge>
      )
  }
}

const rotuloResultado = (r?: string) => (r === 'ganha' ? 'Ganha' : r === 'perdida' ? 'Perdida' : '')

const CONTADORES_INICIAIS: OportunidadesContadores = {
  total: 0,
  sugeridas: 0,
  aprovadas: 0,
  rejeitadas: 0,
  emRevisao: 0,
}

export default function Oportunidades() {
  const { toast } = useToast()
  const navigate = useNavigate()

  const [itens, setItens] = useState<OportunidadeRecord[]>([])
  const [pagina, setPagina] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [total, setTotal] = useState(0)
  const [contadores, setContadores] = useState<OportunidadesContadores>(CONTADORES_INICIAIS)
  const [carregando, setCarregando] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState<string>('')

  const carregar = useCallback(
    async (pag: number, filtro?: string) => {
      setCarregando(true)
      try {
        const f = filtro !== undefined ? filtro : filtroStatus
        // AP-2026-11-11-0545: a UI constrói a expressão completa antes do service
        const expr = f ? `status='${f}'` : undefined
        const [r, c] = await Promise.all([
          oportunidadesService.listPaginado(pag, POR_PAGINA, expr),
          oportunidadesService.contadores(),
        ])
        setItens(r.itens)
        setTotal(r.total)
        setTotalPaginas(Math.max(1, r.totalPaginas))
        setPagina(r.pagina)
        setContadores(c)
      } catch {
        toast({
          title: 'Erro ao carregar as oportunidades',
          description: 'Não foi possível carregar as oportunidades. Tente novamente.',
          variant: 'destructive',
        })
      } finally {
        setCarregando(false)
      }
    },
    [toast, filtroStatus],
  )

  useEffect(() => {
    carregar(1)
  }, [carregar])

  const abrir = (item: OportunidadeRecord) => navigate(`/oportunidades/${item.id}`)

  const contadoresLista = [
    { rotulo: 'Total', valor: contadores.total, filtro: '' },
    { rotulo: 'Sugeridas', valor: contadores.sugeridas, filtro: 'Sugerida' },
    { rotulo: 'Em revisão', valor: contadores.emRevisao, filtro: 'Em revisão' },
    { rotulo: 'Aprovadas', valor: contadores.aprovadas, filtro: 'Aprovada' },
    { rotulo: 'Rejeitadas', valor: contadores.rejeitadas, filtro: 'Rejeitada' },
  ]

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl lg:text-3xl font-extrabold flex items-center gap-3 text-[#030507]">
          <Target className="w-7 h-7 text-[#DE6464]" />
          Oportunidades
        </h1>
        <p className="text-base text-[#6B7280]">
          Sugestões geradas automaticamente a partir de leads qualificados. Clique em uma
          oportunidade para decidir e trabalhar o pipeline.
        </p>
      </div>

      {/* Contadores que também filtram */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {contadoresLista.map((c) => {
          const ativo = filtroStatus === c.filtro
          return (
            <button
              key={c.rotulo}
              type="button"
              onClick={() => {
                setFiltroStatus(c.filtro)
                carregar(1, c.filtro)
              }}
              className={`text-left rounded-2xl border p-5 transition-all ${
                ativo
                  ? 'border-[#DE6464] bg-[#DE6464]/[0.06] ring-2 ring-[#DE6464]/30'
                  : 'border-[#E5E7EB] bg-white hover:border-[#D1D5DB] hover:shadow-sm'
              }`}
            >
              <p className="text-base font-semibold text-[#6B7280]">{c.rotulo}</p>
              <p className="text-3xl font-extrabold text-[#030507] mt-1">{c.valor}</p>
            </button>
          )
        })}
      </div>

      {/* Fila */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-2">
          <p className="text-lg font-bold text-[#030507]">
            {filtroStatus ? `Oportunidades — ${filtroStatus}` : 'Todas as oportunidades'}
          </p>
          <p className="text-base text-[#6B7280]">
            {carregando
              ? 'Carregando…'
              : `${total} ${total === 1 ? 'oportunidade' : 'oportunidades'} · página ${pagina} de ${totalPaginas}`}
          </p>
        </div>

        {itens.length === 0 && !carregando ? (
          <div className="py-16 px-6 text-center text-base text-[#6B7280]">
            Nenhuma oportunidade por enquanto. Quando um lead for qualificado, a sugestão aparece
            aqui automaticamente para você decidir.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#FAF7F2] text-sm font-semibold text-[#6B7280]">
                <tr>
                  <th className="py-3.5 px-6">Lead</th>
                  <th className="py-3.5 px-6">Produto</th>
                  <th className="py-3.5 px-6">Etapa</th>
                  <th className="py-3.5 px-6">Valor estimado</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] text-base text-[#030507]">
                {itens.map((item) => {
                  const lead = item.expand?.lead
                  const resultado = rotuloResultado(item.resultado)
                  return (
                    <tr
                      key={item.id}
                      onClick={() => abrir(item)}
                      className="cursor-pointer hover:bg-[#FAF7F2] transition-colors"
                    >
                      <td className="py-4 px-6">
                        <p className="font-semibold">{lead?.nome || 'Lead removido'}</p>
                        {lead?.empresa && <p className="text-sm text-[#6B7280]">{lead.empresa}</p>}
                      </td>
                      <td className="py-4 px-6">{item.expand?.produto?.nome || '—'}</td>
                      <td className="py-4 px-6">
                        {resultado ? (
                          <span
                            className={`font-semibold ${item.resultado === 'ganha' ? 'text-[#059669]' : 'text-[#B91C1C]'}`}
                          >
                            {resultado}
                          </span>
                        ) : (
                          item.expand?.etapa_atual?.nome || (
                            <span className="text-[#6B7280]">Não iniciado</span>
                          )
                        )}
                      </td>
                      <td className="py-4 px-6">
                        {formatarValor(item.valor_estimado, item.moeda)}
                      </td>
                      <td className="py-4 px-6">{statusBadge(item.status)}</td>
                      <td className="py-4 px-6 text-right">
                        <Button
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            abrir(item)
                          }}
                        >
                          Abrir
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {totalPaginas > 1 && (
          <div className="px-6 py-4 border-t border-[#E5E7EB] flex items-center justify-center gap-4">
            <Button
              variant="outline"
              onClick={() => carregar(Math.max(1, pagina - 1))}
              disabled={pagina <= 1 || carregando}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
            </Button>
            <span className="text-base text-[#374151]">
              Página {pagina} de {totalPaginas}
            </span>
            <Button
              variant="outline"
              onClick={() => carregar(Math.min(totalPaginas, pagina + 1))}
              disabled={pagina >= totalPaginas || carregando}
            >
              Próxima <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
