import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Target, Mail, CheckCircle2, XCircle, RotateCcw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { oportunidadesService, type OportunidadesContadores } from '@/services/oportunidades'
import type { OportunidadeRecord } from '@/types'

const POR_PAGINA = 20

// F1-T14: ação em andamento no modal (campo de comentário aberto)
type ModoDecisao = null | 'revisao' | 'rejeitar' | 'voltar'

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

const formatarDataHora = (valor?: string) => {
  if (!valor) return ''
  const d = new Date(valor.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

const CONTADORES_INICIAIS: OportunidadesContadores = {
  total: 0,
  sugeridas: 0,
  aprovadas: 0,
  rejeitadas: 0,
  emRevisao: 0,
}

export default function Oportunidades() {
  const { toast } = useToast()

  const [itens, setItens] = useState<OportunidadeRecord[]>([])
  const [pagina, setPagina] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [total, setTotal] = useState(0)
  const [contadores, setContadores] = useState<OportunidadesContadores>(CONTADORES_INICIAIS)
  const [carregando, setCarregando] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState<string>('')

  const [itemSelecionado, setItemSelecionado] = useState<OportunidadeRecord | null>(null)
  const [modo, setModo] = useState<ModoDecisao>(null)
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)

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
    setModo(null)
    setTexto('')
  }

  const fecharDetalhe = () => {
    setItemSelecionado(null)
    setModo(null)
    setTexto('')
  }

  const escolherModo = (m: ModoDecisao) => {
    setModo(m)
    setTexto('')
  }

  // F1-T14: executa a decisão; o modal permanece aberto mostrando o estado resultante
  // (AP-2026-11-11-0600 — efeito visível onde o usuário está) e a fila é recarregada.
  const decidir = async (acao: 'aprovar' | 'revisao' | 'rejeitar' | 'voltar') => {
    if (!itemSelecionado) return
    setSalvando(true)
    try {
      let atualizado: OportunidadeRecord
      let titulo: string
      if (acao === 'aprovar') {
        atualizado = await oportunidadesService.aprovar(itemSelecionado)
        titulo = 'Oportunidade aprovada'
      } else if (acao === 'rejeitar') {
        atualizado = await oportunidadesService.rejeitar(itemSelecionado, texto)
        titulo = 'Oportunidade rejeitada'
      } else {
        atualizado = await oportunidadesService.pedirRevisao(itemSelecionado, texto)
        titulo = 'Oportunidade em revisão'
      }
      toast({ title: titulo })
      setItemSelecionado(atualizado)
      setModo(null)
      setTexto('')
      carregar(pagina)
    } catch (err) {
      toast({
        title: 'Não foi possível registrar a decisão',
        description: err instanceof Error ? err.message : 'Ocorreu uma falha inesperada.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const nomeLead = (item: OportunidadeRecord) => {
    const l = item.expand?.lead
    return l ? `${l.nome} — ${l.empresa}` : 'Lead removido'
  }

  const nomeDecisor = (item: OportunidadeRecord) =>
    item.expand?.decidido_por?.name || item.expand?.decidido_por?.email || 'Usuário'

  const aberta = itemSelecionado?.status === 'Sugerida' || itemSelecionado?.status === 'Em revisão'

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

      {/* Contadores (F1-T14: + Rejeitadas e Em revisão) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { rotulo: 'Total na fila', valor: contadores.total },
          { rotulo: 'Sugeridas', valor: contadores.sugeridas },
          { rotulo: 'Em revisão', valor: contadores.emRevisao },
          { rotulo: 'Aprovadas', valor: contadores.aprovadas },
          { rotulo: 'Rejeitadas', valor: contadores.rejeitadas },
        ].map((c) => (
          <Card key={c.rotulo}>
            <CardHeader className="pb-2">
              <CardDescription>{c.rotulo}</CardDescription>
              <CardTitle className="text-2xl">{c.valor}</CardTitle>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
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

      {/* Modal de detalhe + decisões (F1-T14) */}
      <Dialog open={!!itemSelecionado} onOpenChange={(open) => !open && fecharDetalhe()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
              {/* Situação da oportunidade + última decisão */}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {statusBadge(itemSelecionado.status)}
                {itemSelecionado.decidido_em && (
                  <span className="text-xs text-muted-foreground">
                    Decidido em {formatarDataHora(itemSelecionado.decidido_em)} por{' '}
                    {nomeDecisor(itemSelecionado)}
                  </span>
                )}
              </div>

              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="font-medium mb-1">Por que esta oportunidade foi sugerida</p>
                <p className="text-muted-foreground">{itemSelecionado.justificativa}</p>
                <div className="mt-2">{confiancaBadge(itemSelecionado.confianca)}</div>
              </div>

              {/* Histórico de comentários (decisões e requalificações acumuladas) */}
              {itemSelecionado.comentario && (
                <div className="rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm">
                  <p className="font-medium mb-1">Comentários</p>
                  <p className="whitespace-pre-line text-muted-foreground">
                    {itemSelecionado.comentario}
                  </p>
                </div>
              )}

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
                  <p className="text-muted-foreground">Lead não disponível.</p>
                )}
              </div>

              {/* Contato do lead — o executivo precisa ver com quem falar */}
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
                          Nenhum contato registrado neste lead.
                        </p>
                      )}
                  </div>
                </div>
              )}

              {/* Campo de comentário da decisão em andamento */}
              {modo && (
                <div className="space-y-1.5">
                  <Label htmlFor="comentario-decisao">
                    {modo === 'rejeitar'
                      ? 'Motivo da rejeição (obrigatório)'
                      : modo === 'voltar'
                        ? 'Justificativa da volta para revisão (obrigatória)'
                        : 'Comentário para a revisão (opcional)'}
                  </Label>
                  <Textarea
                    id="comentario-decisao"
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    rows={3}
                    placeholder={
                      modo === 'rejeitar'
                        ? 'Explique por que esta oportunidade não será seguida.'
                        : modo === 'voltar'
                          ? 'Explique por que a aprovação precisa ser revista.'
                          : 'Recomendado: indique o que precisa ser revisado.'
                    }
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => escolherModo(null)} disabled={salvando}>
                      Cancelar
                    </Button>
                    {modo === 'rejeitar' && (
                      <Button
                        variant="destructive"
                        onClick={() => decidir('rejeitar')}
                        disabled={salvando || !texto.trim()}
                      >
                        {salvando ? 'Registrando…' : 'Confirmar rejeição'}
                      </Button>
                    )}
                    {modo === 'revisao' && (
                      <Button onClick={() => decidir('revisao')} disabled={salvando}>
                        {salvando ? 'Registrando…' : 'Confirmar pedido de revisão'}
                      </Button>
                    )}
                    {modo === 'voltar' && (
                      <Button
                        onClick={() => decidir('voltar')}
                        disabled={salvando || !texto.trim()}
                      >
                        {salvando ? 'Registrando…' : 'Confirmar volta para revisão'}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Botões de decisão */}
              {!modo && (
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={fecharDetalhe}>
                    Fechar
                  </Button>
                  {aberta && (
                    <>
                      <Button
                        variant="outline"
                        className="text-red-700"
                        onClick={() => escolherModo('rejeitar')}
                        disabled={salvando}
                      >
                        <XCircle className="w-4 h-4 mr-1.5" />
                        Rejeitar
                      </Button>
                      {itemSelecionado.status === 'Sugerida' && (
                        <Button
                          variant="outline"
                          onClick={() => escolherModo('revisao')}
                          disabled={salvando}
                        >
                          <RotateCcw className="w-4 h-4 mr-1.5" />
                          Pedir revisão
                        </Button>
                      )}
                      <Button
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => decidir('aprovar')}
                        disabled={salvando}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1.5" />
                        {salvando ? 'Registrando…' : 'Aprovar'}
                      </Button>
                    </>
                  )}
                  {itemSelecionado.status === 'Aprovada' && (
                    <Button
                      variant="outline"
                      onClick={() => escolherModo('voltar')}
                      disabled={salvando}
                    >
                      <RotateCcw className="w-4 h-4 mr-1.5" />
                      Voltar para revisão
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
