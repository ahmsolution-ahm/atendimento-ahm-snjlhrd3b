import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { ArrowLeftRight, Search, Users } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { transbordosService } from '@/services/transbordos'
import { usersService } from '@/services/users'
import type { TransbordoRecord, UserRecord } from '@/types'

const POR_PAGINA = 20

const statusBadge = (status: TransbordoRecord['status']) => {
  switch (status) {
    case 'Resolvido':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Resolvido</Badge>
    case 'Aberto':
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Aberto</Badge>
    default:
      return (
        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
          Pendente atribuição
        </Badge>
      )
  }
}

export default function Transbordos() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [itens, setItens] = useState<TransbordoRecord[]>([])
  const [pagina, setPagina] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [total, setTotal] = useState(0)
  const [contadores, setContadores] = useState({ total: 0, abertos: 0, pendentes: 0 })
  const [especialistas, setEspecialistas] = useState<UserRecord[]>([])
  const [carregando, setCarregando] = useState(true)

  // F1-T11: filtro por status (server-side) — pendentes de atribuição isoláveis
  const [filtroStatus, setFiltroStatus] = useState<string>('')

  const [itemSelecionado, setItemSelecionado] = useState<TransbordoRecord | null>(null)
  const [resolucao, setResolucao] = useState('')
  const [especialistaEscolhido, setEspecialistaEscolhido] = useState('')
  const [comentarioReabertura, setComentarioReabertura] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(
    async (pag: number, filtro?: string) => {
      setCarregando(true)
      try {
        const f = filtro !== undefined ? filtro : filtroStatus
        // o chip entrega o VALOR do status; o serviço espera expressão de filtro
        const expr = f ? `status='${f}'` : undefined
        const r = await transbordosService.listPaginado(pag, POR_PAGINA, expr)
        setItens(r.itens)
        setTotal(r.total)
        setTotalPaginas(Math.max(1, r.totalPaginas))
        setPagina(r.pagina)
        const c = await transbordosService.contadores()
        setContadores(c)
      } catch {
        toast({
          title: 'Erro ao carregar fila',
          description: 'Não foi possível carregar os transbordos.',
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

  useEffect(() => {
    usersService
      .list()
      .then(setEspecialistas)
      .catch(() => setEspecialistas([]))
  }, [])

  const abrirDetalhe = (item: TransbordoRecord) => {
    setItemSelecionado(item)
    setResolucao(item.resolucao || '')
    setEspecialistaEscolhido(item.expand?.especialista?.id || item.especialista || '')
    setComentarioReabertura('')
  }

  // F1-T12: reabrir transbordo resolvido (rollback auditável com motivo)
  const reabrir = async () => {
    if (!itemSelecionado || !comentarioReabertura.trim()) return
    setSalvando(true)
    try {
      await transbordosService.reabrir(itemSelecionado.id, comentarioReabertura.trim())
      toast({ title: 'Transbordo reaberto' })
      setItemSelecionado(null)
      carregar(pagina)
    } catch (err) {
      toast({
        title: 'Erro ao reabrir',
        description: err instanceof Error ? err.message : 'Falha inesperada.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const salvar = async () => {
    if (!itemSelecionado) return
    setSalvando(true)
    try {
      // atribuição (cenário limite: pendente → aberto com especialista)
      if (
        itemSelecionado.status === 'Pendente atribuição' &&
        especialistaEscolhido &&
        especialistaEscolhido !== (itemSelecionado.expand?.especialista?.id || '')
      ) {
        await transbordosService.atribuir(itemSelecionado.id, especialistaEscolhido)
      }
      // resolução (RN-1.12: só fecha com texto)
      if (itemSelecionado.status !== 'Resolvido' && resolucao.trim()) {
        await transbordosService.resolver(itemSelecionado.id, resolucao.trim())
      }
      toast({ title: 'Transbordo atualizado' })
      setItemSelecionado(null)
      carregar(pagina)
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: err instanceof Error ? err.message : 'Falha inesperada.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const nomeLead = (item: TransbordoRecord) => {
    const l = item.expand?.lead
    return l ? `${l.nome} — ${l.empresa}` : 'lead removido'
  }

  return (
    <div className="space-y-6 p-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ArrowLeftRight className="w-6 h-6" />
          Fila de Transbordo
        </h1>
        <p className="text-sm text-muted-foreground">
          Casos técnicos complexos encaminhados para avaliação de um especialista.
        </p>
      </div>

      {/* F1-T11: filtro por status (server-side) */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Todos', valor: '' },
          { label: 'Pendente atribuição', valor: 'Pendente atribuição' },
          { label: 'Aberto', valor: 'Aberto' },
          { label: 'Resolvido', valor: 'Resolvido' },
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
            <CardDescription>Abertos</CardDescription>
            <CardTitle className="text-2xl">{contadores.abertos}</CardTitle>
          </CardHeader>
          <CardContent />
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pendentes de atribuição</CardDescription>
            <CardTitle className="text-2xl">{contadores.pendentes}</CardTitle>
          </CardHeader>
          <CardContent />
        </Card>
      </div>

      {/* Fila */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="w-4 h-4" /> Itens na fila
          </CardTitle>
          <CardDescription>
            {carregando ? 'Carregando…' : `${total} item(ns) — página ${pagina} de ${totalPaginas}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {itens.length === 0 && !carregando ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhum transbordo na fila. Leads marcados como transbordo na qualificação aparecem
              aqui automaticamente.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Especialista</TableHead>
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
                      {item.motivo}
                    </TableCell>
                    <TableCell>
                      {item.expand?.especialista?.name ||
                        item.expand?.especialista?.email ||
                        'Sem especialista atribuído'}
                    </TableCell>
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

      {/* Modal de tratamento */}
      <Dialog open={!!itemSelecionado} onOpenChange={(open) => !open && setItemSelecionado(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Transbordo — {itemSelecionado ? nomeLead(itemSelecionado) : ''}
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
                <p className="font-medium mb-1">Motivo do transbordo</p>
                <p className="text-muted-foreground">{itemSelecionado.motivo}</p>
                {itemSelecionado.comentario && (
                  <p className="text-xs text-muted-foreground mt-2">{itemSelecionado.comentario}</p>
                )}
              </div>

              {itemSelecionado.status === 'Resolvido' ? (
                <div className="space-y-3">
                  <div className="rounded-lg bg-green-50 p-3 text-sm">
                    <p className="font-medium mb-1">Resolução registrada</p>
                    <p className="text-muted-foreground">{itemSelecionado.resolucao}</p>
                    {itemSelecionado.expand?.resolvido_por && (
                      <p className="text-xs text-muted-foreground mt-2">
                        por {itemSelecionado.expand.resolvido_por.name || 'usuário'}
                      </p>
                    )}
                  </div>
                  {/* F1-T12: situação atual do lead — visível sem sair da fila */}
                  <div className="rounded-lg bg-muted p-3 text-sm">
                    <p className="font-medium mb-1">Situação do lead</p>
                    {itemSelecionado.expand?.lead ? (
                      <p className="text-muted-foreground">
                        {itemSelecionado.expand.lead.nome} está{' '}
                        <span className="font-semibold text-[#030507]">
                          {itemSelecionado.expand.lead.status}
                        </span>
                        {itemSelecionado.expand.lead.status === 'pendente' &&
                          ' — devolvido para nova qualificação. Requalifique na tela Leads.'}
                      </p>
                    ) : (
                      <p className="text-muted-foreground">lead não disponível</p>
                    )}
                  </div>
                  {/* F1-T12: reabrir com motivo (rollback auditável) */}
                  <div className="space-y-1.5">
                    <Label>Reabrir transbordo (motivo obrigatório)</Label>
                    <Textarea
                      value={comentarioReabertura}
                      onChange={(e) => setComentarioReabertura(e.target.value)}
                      placeholder="Por que este transbordo volta para Aberto?…"
                      rows={2}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={reabrir}
                      disabled={salvando || !comentarioReabertura.trim()}
                    >
                      {salvando ? 'Reabrindo…' : 'Reabrir transbordo'}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Atribuição de especialista */}
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Especialista
                    </Label>
                    <Select value={especialistaEscolhido} onValueChange={setEspecialistaEscolhido}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar especialista…" />
                      </SelectTrigger>
                      <SelectContent>
                        {especialistas.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name || u.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Resolução */}
                  <div className="space-y-1.5">
                    <Label>Resolução do especialista (obrigatória para fechar)</Label>
                    <Textarea
                      value={resolucao}
                      onChange={(e) => setResolucao(e.target.value)}
                      placeholder="Resposta/instrução do especialista para devolver o lead…"
                      rows={4}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setItemSelecionado(null)}>
                      Cancelar
                    </Button>
                    <Button onClick={salvar} disabled={salvando}>
                      {salvando ? 'Salvando…' : 'Salvar'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
