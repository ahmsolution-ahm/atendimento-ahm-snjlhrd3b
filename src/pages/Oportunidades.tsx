import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from '@/components/ui/pagination'
import { Target, Mail } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { oportunidadesService } from '@/services/oportunidades'
import type { OportunidadeRecord } from '@/types'

const POR_PAGINA = 20

const statusBadge = (status: OportunidadeRecord['status']) => {
  switch (status) {
    case 'Aprovada':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Aprovada</Badge>
    case 'Rejeitada':
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Rejeitada</Badge>
    case 'Em revisão':
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Em revisão</Badge>
    default:
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Sugerida</Badge>
  }
}

const confiancaBadge = (c?: string) => {
  if (c === 'alta')
    return <Badge className="bg-green-50 text-green-700 hover:bg-green-50">Confiança alta</Badge>
  if (c === 'média')
    return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50">Confiança média</Badge>
  if (c === 'baixa')
    return <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">Confiança baixa</Badge>
  return null
}

export default function Oportunidades() {
  const { toast } = useToast()

  const [itens, setItens] = useState<OportunidadeRecord[]>([])
  const [pagina, setPagina] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [total, setTotal] = useState(0)
  const [contadores, setContadores] = useState({ total: 0, sugeridas: 0, aprovadas: 0 })
  const [carregando, setCarregando] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState<string>('')

  const [itemSelecionado, setItemSelecionado] = useState<OportunidadeRecord | null>(null)

  const carregar = useCallback(
    async (pag: number, filtro?: string) => {
      setCarregando(true)
      try {
        const f = filtro !== undefined ? filtro : filtroStatus
        // AP-2026-11-11-0545: a UI constrói a expressão completa antes do service
        const expr = f ? `status='${f}'` : undefined
        const r = await oportunidadesService.listPaginado(pag, POR_PAGINA, expr)
        setItens(r.itens)
        setTotal(r.total)
        setTotalPaginas(Math.max(1, r.totalPaginas))
        setPagina(r.pagina)
        const c = await oportunidadesService.contadores()
        setContadores(c)
      } catch {
        toast({
          title: 'Erro ao carregar fila',
          description: 'Não foi possível carregar as oportunidades.',
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

  const abrirDetalhe = (item: OportunidadeRecord) => {
    setItemSelecionado(item)
  }

  const nomeLead = (item: OportunidadeRecord) => {
    const l = item.expand?.lead
    return l ? `${l.nome} — ${l.empresa}` : 'lead removido'
  }

  return (
    <div className="space-y-6 p-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Target className="w-6 h-6" />
          Oportunidades
        </h1>
        <p className="text-sm text-muted-foreground">
          Sugestões geradas automaticamente a partir de leads qualificados — prontas para sua
          decisão.
        </p>
      </div>

      {/* F1-T11/AP-0545: filtro por status (chips server-side) */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Todos', valor: '' },
          { label: 'Sugerida', valor: 'Sugerida' },
          { label: 'Aprovada', valor: 'Aprovada' },
          { label: 'Rejeitada', valor: 'Rejeitada' },
          { label: 'Em revisão', valor: 'Em revisão' },
        ].map((op) => (
          <button
            key={op.valor}
            type="button"
            onClick={() => {
              setFiltroStatus(op.valor)
              carregar(1, op.valor)
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filtroStatus === op.valor
                ? 'bg-[#DE6464] text-white shadow-sm'
                : 'bg-white text-[#374151] border border-[#E5E7EB] hover:bg-[#F3F4F6]'
            }`}
          >
            {op.label}
          </button>
        ))}
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total na fila</CardDescription>
            <CardTitle className="text-2xl">{contadores.total}</CardTitle>
          </CardHeader>
          <CardContent />
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sugeridas</CardDescription>
            <CardTitle className="text-2xl">{contadores.sugeridas}</CardTitle>
          </CardHeader>
          <CardContent />
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Aprovadas</CardDescription>
            <CardTitle className="text-2xl">{contadores.aprovadas}</CardTitle>
          </CardHeader>
          <CardContent />
        </Card>
      </div>

      {/* Fila */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Oportunidades</CardTitle>
          <CardDescription>
            {carregando
              ? 'Carregando…'
              : `${total} ${total === 1 ? 'item' : 'itens'} — página ${pagina} de ${totalPaginas}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {itens.length === 0 && !carregando ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma oportunidade por enquanto. Quando um lead for qualificado, a sugestão aparece
              aqui automaticamente para você decidir.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Justificativa</TableHead>
                  <TableHead>Confiança</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{nomeLead(item)}</TableCell>
                    <TableCell>{item.expand?.produto?.nome || '—'}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                      {item.justificativa}
                    </TableCell>
                    <TableCell>{confiancaBadge(item.confianca)}</TableCell>
                    <TableCell>{statusBadge(item.status)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => abrirDetalhe(item)}>
                        Abrir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Paginação */}
          {totalPaginas > 1 && (
            <div className="mt-4 flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        carregar(Math.max(1, pagina - 1))
                      }}
                    />
                  </PaginationItem>
                  <PaginationItem className="text-sm self-center px-2">
                    Página {pagina} de {totalPaginas}
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        carregar(Math.min(totalPaginas, pagina + 1))
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalhe (decisões humanas são da F1-T14) */}
      <Dialog open={!!itemSelecionado} onOpenChange={(open) => !open && setItemSelecionado(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Oportunidade — {itemSelecionado ? nomeLead(itemSelecionado) : ''}
            </DialogTitle>
            <DialogDescription>
              {itemSelecionado?.expand?.produto?.nome
                ? `Produto: ${itemSelecionado.expand.produto.nome}`
                : 'Produto não informado'}
            </DialogDescription>
          </DialogHeader>

          {itemSelecionado && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="font-medium mb-1">Por que esta oportunidade foi sugerida</p>
                <p className="text-muted-foreground">{itemSelecionado.justificativa}</p>
                <div className="mt-2">{confiancaBadge(itemSelecionado.confianca)}</div>
              </div>
              {/* AP-2026-11-11-0600: situação do lead visível onde o usuário está */}
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="font-medium mb-1">Situação do lead</p>
                {itemSelecionado.expand?.lead ? (
                  <p className="text-muted-foreground">
                    {itemSelecionado.expand.lead.nome} está{' '}
                    <span className="font-semibold text-[#030507]">
                      {itemSelecionado.expand.lead.status}
                    </span>
                  </p>
                ) : (
                  <p className="text-muted-foreground">lead não disponível</p>
                )}
              </div>
              {/* Contato do lead — o executivo precisa ver com quem falar (F1-T13 correção) */}
              {itemSelecionado.expand?.lead && (
                <div className="rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm">
                  <p className="font-medium mb-1.5">Contato</p>
                  <div className="space-y-1 text-[#374151]">
                    {itemSelecionado.expand.lead.contato && (
                      <p className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-[#DE6464]" />
                        {itemSelecionado.expand.lead.contato}
                      </p>
                    )}
                    {itemSelecionado.expand.lead.observacoes && (
                      <p className="text-xs text-muted-foreground">
                        {itemSelecionado.expand.lead.observacoes}
                      </p>
                    )}
                    {!itemSelecionado.expand.lead.contato &&
                      !itemSelecionado.expand.lead.observacoes && (
                        <p className="text-muted-foreground">
                          Nenhum contato registrado neste lead
                        </p>
                      )}
                  </div>
                </div>
              )}
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setItemSelecionado(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
