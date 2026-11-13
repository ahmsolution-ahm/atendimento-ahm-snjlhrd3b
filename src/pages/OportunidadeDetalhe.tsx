import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Lightbulb,
  Mail,
  MessageSquare,
  Phone,
  RotateCcw,
  User,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { oportunidadesService } from '@/services/oportunidades'
import PipelineOportunidade from '@/components/PipelineOportunidade'
import { formatarValor } from '@/lib/pipeline'
import type { OportunidadeRecord, PipelineEtapaRecord } from '@/types'

// Bloco B — página própria da oportunidade (antes: modal estreito). Concentra decisão
// (aprovar / pedir revisão / rejeitar / voltar para revisão), pipeline, checklist, fechamento,
// resultado e histórico em tela inteira. A fila (/oportunidades) só lista e abre esta página.

type ModoDecisao = null | 'revisao' | 'rejeitar' | 'voltar'

const statusBadge = (status: OportunidadeRecord['status']) => {
  const base = 'text-sm px-3 py-1'
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

const rotuloConfianca = (c?: string) =>
  c === 'alta'
    ? 'Confiança alta'
    : c === 'média'
      ? 'Confiança média'
      : c === 'baixa'
        ? 'Confiança baixa'
        : ''

const rotuloStatusLead = (s?: string) => {
  switch (s) {
    case 'pendente':
      return 'Pendente'
    case 'qualificado':
      return 'Qualificado'
    case 'transbordo':
      return 'Transbordo'
    case 'fora do recorte':
      return 'Fora do recorte'
    default:
      return s || '—'
  }
}

const formatarDataHora = (valor?: string) => {
  if (!valor) return ''
  const d = new Date(valor.replace(' ', 'T'))
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

const cartaoCls = 'rounded-2xl border border-[#E5E7EB] bg-white p-5 lg:p-6 shadow-sm'
const tituloCls = 'text-lg font-bold text-[#030507] flex items-center gap-2'

export default function OportunidadeDetalhe() {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()

  const [item, setItem] = useState<OportunidadeRecord | null>(null)
  const [etapas, setEtapas] = useState<PipelineEtapaRecord[]>([])
  const [carregando, setCarregando] = useState(true)
  const [naoEncontrada, setNaoEncontrada] = useState(false)

  const [modo, setModo] = useState<ModoDecisao>(null)
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    if (!id) return
    setCarregando(true)
    try {
      const [op, et] = await Promise.all([
        oportunidadesService.getById(id),
        oportunidadesService.etapas().catch(() => [] as PipelineEtapaRecord[]),
      ])
      setItem(op)
      setEtapas(et)
      setNaoEncontrada(false)
    } catch {
      setNaoEncontrada(true)
    } finally {
      setCarregando(false)
    }
  }, [id])

  useEffect(() => {
    carregar()
  }, [carregar])

  const escolherModo = (m: ModoDecisao) => {
    setModo(m)
    setTexto('')
  }

  // F1-T14: a página permanece mostrando o estado resultante (efeito visível onde o usuário está)
  const decidir = async (acao: 'aprovar' | 'revisao' | 'rejeitar' | 'voltar') => {
    if (!item) return
    setSalvando(true)
    try {
      let atualizado: OportunidadeRecord
      let titulo: string
      if (acao === 'aprovar') {
        atualizado = await oportunidadesService.aprovar(item)
        titulo = 'Oportunidade aprovada'
      } else if (acao === 'rejeitar') {
        atualizado = await oportunidadesService.rejeitar(item, texto)
        titulo = 'Oportunidade rejeitada'
      } else {
        atualizado = await oportunidadesService.pedirRevisao(item, texto)
        titulo = 'Oportunidade em revisão'
      }
      toast({ title: titulo })
      setItem(atualizado)
      setModo(null)
      setTexto('')
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

  if (carregando && !item) {
    return (
      <div className="py-24 text-center text-lg text-[#6B7280]">Carregando a oportunidade…</div>
    )
  }

  if (naoEncontrada || !item) {
    return (
      <div className="py-24 text-center space-y-4">
        <p className="text-xl font-semibold text-[#030507]">Oportunidade não encontrada.</p>
        <p className="text-base text-[#6B7280]">
          Ela pode ter sido removida ou você não tem acesso a ela.
        </p>
        <Link
          to="/oportunidades"
          className="inline-flex items-center gap-2 text-base font-semibold text-[#DE6464] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para as oportunidades
        </Link>
      </div>
    )
  }

  const lead = item.expand?.lead
  const produto = item.expand?.produto
  const aberta = item.status === 'Sugerida' || item.status === 'Em revisão'
  const nomeDecisor =
    item.expand?.decidido_por?.name || item.expand?.decidido_por?.email || 'Usuário'

  const lateral = (
    <>
      {/* Lead e contato */}
      <div className={`${cartaoCls} space-y-3`}>
        <p className={tituloCls}>
          <User className="w-5 h-5 text-[#DE6464]" /> Lead
        </p>
        {lead ? (
          <>
            <div>
              <p className="text-lg font-semibold text-[#030507]">{lead.nome}</p>
              <p className="text-base text-[#6B7280]">{lead.empresa}</p>
              <p className="text-sm text-[#6B7280] mt-1">
                Situação:{' '}
                <span className="font-semibold text-[#030507]">
                  {rotuloStatusLead(lead.status)}
                </span>
              </p>
            </div>
            <div className="space-y-2 text-base text-[#374151]">
              {lead.contato && (
                <p className="flex items-center gap-2 break-all">
                  <Mail className="w-4 h-4 text-[#DE6464] shrink-0" />
                  {lead.contato}
                </p>
              )}
              {lead.telefone && (
                <p className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#DE6464] shrink-0" />
                  {lead.telefone}
                </p>
              )}
              {!lead.contato && !lead.telefone && (
                <p className="text-[#6B7280]">Nenhum contato registrado neste lead.</p>
              )}
              {lead.observacoes && <p className="text-sm text-[#6B7280]">{lead.observacoes}</p>}
            </div>
          </>
        ) : (
          <p className="text-base text-[#6B7280]">Lead não disponível.</p>
        )}
      </div>

      {/* Por que foi sugerida */}
      <div className={`${cartaoCls} space-y-2`}>
        <p className={tituloCls}>
          <Lightbulb className="w-5 h-5 text-[#DE6464]" /> Por que foi sugerida
        </p>
        <p className="text-base text-[#374151]">{item.justificativa || '—'}</p>
        {rotuloConfianca(item.confianca) && (
          <p className="text-sm font-semibold text-[#6B7280]">{rotuloConfianca(item.confianca)}</p>
        )}
      </div>

      {/* Comentários acumulados das decisões */}
      {item.comentario && (
        <div className={`${cartaoCls} space-y-2`}>
          <p className={tituloCls}>
            <MessageSquare className="w-5 h-5 text-[#DE6464]" /> Comentários
          </p>
          <p className="whitespace-pre-line text-base text-[#374151]">{item.comentario}</p>
        </div>
      )}
    </>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho */}
      <div className="space-y-4">
        <Link
          to="/oportunidades"
          className="inline-flex items-center gap-2 text-base font-semibold text-[#6B7280] hover:text-[#DE6464]"
        >
          <ArrowLeft className="w-4 h-4" /> Oportunidades
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl lg:text-3xl font-extrabold text-[#030507] tracking-tight">
              {lead ? `${lead.nome} — ${lead.empresa}` : 'Oportunidade'}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-base text-[#6B7280]">
              {statusBadge(item.status)}
              <span>
                Produto:{' '}
                <span className="font-semibold text-[#030507]">
                  {produto?.nome || 'não informado'}
                </span>
              </span>
              {item.valor_estimado ? (
                <span>
                  Valor:{' '}
                  <span className="font-semibold text-[#030507]">
                    {formatarValor(item.valor_estimado, item.moeda)}
                  </span>
                </span>
              ) : null}
            </div>
            {item.decidido_em && (
              <p className="text-sm text-[#6B7280]">
                Última decisão em {formatarDataHora(item.decidido_em)} por {nomeDecisor}.
              </p>
            )}
          </div>

          {/* Decisão */}
          {!modo && (
            <div className="flex flex-wrap gap-3 lg:justify-end">
              {aberta && (
                <>
                  <Button
                    size="lg"
                    variant="outline"
                    className="text-red-700"
                    onClick={() => escolherModo('rejeitar')}
                    disabled={salvando}
                  >
                    <XCircle className="w-4 h-4 mr-1.5" /> Rejeitar
                  </Button>
                  {item.status === 'Sugerida' && (
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => escolherModo('revisao')}
                      disabled={salvando}
                    >
                      <RotateCcw className="w-4 h-4 mr-1.5" /> Pedir revisão
                    </Button>
                  )}
                  <Button
                    size="lg"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => decidir('aprovar')}
                    disabled={salvando}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    {salvando ? 'Registrando…' : 'Aprovar'}
                  </Button>
                </>
              )}
              {item.status === 'Aprovada' && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => escolherModo('voltar')}
                  disabled={salvando}
                >
                  <RotateCcw className="w-4 h-4 mr-1.5" /> Voltar para revisão
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Comentário da decisão em andamento */}
        {modo && (
          <div className={`${cartaoCls} space-y-3`}>
            <label
              htmlFor="comentario-decisao"
              className="block text-base font-semibold text-[#030507]"
            >
              {modo === 'rejeitar'
                ? 'Motivo da rejeição (obrigatório)'
                : modo === 'voltar'
                  ? 'Justificativa da volta para revisão (obrigatória)'
                  : 'Comentário para a revisão (opcional)'}
            </label>
            <textarea
              id="comentario-decisao"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E7EB] text-base text-[#030507] bg-white outline-none focus:border-[#DE6464] focus:ring-2 focus:ring-[#DE6464]/20"
              placeholder={
                modo === 'rejeitar'
                  ? 'Explique por que esta oportunidade não será seguida.'
                  : modo === 'voltar'
                    ? 'Explique por que a aprovação precisa ser revista.'
                    : 'Recomendado: indique o que precisa ser revisado.'
              }
            />
            <div className="flex justify-end gap-3">
              <Button
                variant="ghost"
                size="lg"
                onClick={() => escolherModo(null)}
                disabled={salvando}
              >
                Cancelar
              </Button>
              {modo === 'rejeitar' && (
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={() => decidir('rejeitar')}
                  disabled={salvando || !texto.trim()}
                >
                  {salvando ? 'Registrando…' : 'Confirmar rejeição'}
                </Button>
              )}
              {modo === 'revisao' && (
                <Button size="lg" onClick={() => decidir('revisao')} disabled={salvando}>
                  {salvando ? 'Registrando…' : 'Confirmar pedido de revisão'}
                </Button>
              )}
              {modo === 'voltar' && (
                <Button
                  size="lg"
                  onClick={() => decidir('voltar')}
                  disabled={salvando || !texto.trim()}
                >
                  {salvando ? 'Registrando…' : 'Confirmar volta para revisão'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <PipelineOportunidade
        item={item}
        etapas={etapas}
        onAtualizado={(atualizado) => setItem(atualizado)}
        lateral={lateral}
      />
    </div>
  )
}
