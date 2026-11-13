import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ClipboardCheck,
  Compass,
  Flag,
  History,
  RotateCcw,
  ThumbsDown,
  Trophy,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { oportunidadesService } from '@/services/oportunidades'
import {
  camposFaltantesParaMover,
  derivarFechamento,
  etapaVizinha,
  etapasDaTrilha,
  formatarValor,
  insucessosMarcados,
  proximoPasso,
  resumoCriterios,
  rotuloTrilha,
  trilhaDoProduto,
} from '@/lib/pipeline'
import type {
  AmbienteFechamento,
  ChecklistItemRecord,
  FechamentoRecord,
  OportunidadeEtapaRecord,
  OportunidadeRecord,
  PipelineEtapaRecord,
} from '@/types'

// Fase 2 — fechamento, pipeline de duas trilhas, checklist por etapa, resultado ganho/perda
// e históricos. Bloco B: desenhado para a PÁGINA da oportunidade (tela inteira), não para um
// modal: pipeline na horizontal, "Próximo passo" em destaque, etapa atual e checklist com
// espaço, fechamento e resultado sempre visíveis na coluna lateral.
// Fluxo guiado: enquanto faltar ambiente/valor, os botões de mudar de etapa ficam
// desabilitados com o motivo ao lado e a seção Fechamento é destacada (o servidor continua
// validando; a tela evita a tentativa às cegas).

const formatarDataHora = (valor?: string) => {
  if (!valor) return ''
  const d = new Date(valor.replace(' ', 'T'))
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

const campoCls =
  'w-full px-3.5 py-2.5 rounded-xl border border-[#E5E7EB] text-base text-[#030507] bg-white outline-none focus:border-[#DE6464] focus:ring-2 focus:ring-[#DE6464]/20 disabled:bg-[#F9FAFB]'
const cartaoCls = 'rounded-2xl border border-[#E5E7EB] bg-white p-5 lg:p-6 shadow-sm'
const tituloCls = 'text-lg font-bold text-[#030507] flex items-center gap-2'
const rotuloCls = 'block text-sm font-semibold text-[#374151] mb-1.5'

export default function PipelineOportunidade({
  item,
  etapas,
  onAtualizado,
  lateral,
}: {
  item: OportunidadeRecord
  etapas: PipelineEtapaRecord[]
  onAtualizado: (item: OportunidadeRecord) => void
  /** conteúdo extra no topo da coluna lateral (dados do lead, contato etc.) */
  lateral?: ReactNode
}) {
  const { toast } = useToast()
  const [ambiente, setAmbiente] = useState<AmbienteFechamento | ''>(item.ambiente_fechamento || '')
  const [valor, setValor] = useState<string>(
    item.valor_estimado && item.valor_estimado > 0 ? String(item.valor_estimado) : '',
  )
  const [historico, setHistorico] = useState<OportunidadeEtapaRecord[]>([])
  const [respostasPorHist, setRespostasPorHist] = useState<Record<string, number>>({})
  const [fechamentos, setFechamentos] = useState<FechamentoRecord[]>([])
  const [itensChecklist, setItensChecklist] = useState<ChecklistItemRecord[]>([])
  const [salvando, setSalvando] = useState(false)

  // checklist da conclusão de etapa
  const [concluindo, setConcluindo] = useState(false)
  const [marcados, setMarcados] = useState<Record<string, boolean>>({})
  const [observacoes, setObservacoes] = useState<Record<string, string>>({})
  const [alertaConfirmado, setAlertaConfirmado] = useState(false)

  // resultado (ganha/perdida) e reabertura
  const [modoResultado, setModoResultado] = useState<null | 'ganha' | 'perdida' | 'reabrir'>(null)
  const [motivo, setMotivo] = useState('')
  const [concorrente, setConcorrente] = useState('')

  useEffect(() => {
    setAmbiente(item.ambiente_fechamento || '')
    setValor(item.valor_estimado && item.valor_estimado > 0 ? String(item.valor_estimado) : '')
  }, [item.id, item.ambiente_fechamento, item.valor_estimado])

  useEffect(() => {
    oportunidadesService
      .checklistItens()
      .then(setItensChecklist)
      .catch(() => setItensChecklist([]))
  }, [])

  const carregarHistoricos = useCallback(async () => {
    try {
      const [h, f] = await Promise.all([
        oportunidadesService.historico(item.id),
        oportunidadesService.fechamentos(item.id),
      ])
      setHistorico(h)
      setFechamentos(f)
      const contagem: Record<string, number> = {}
      await Promise.all(
        h.map(async (reg) => {
          const rs = await oportunidadesService.checklistRespostas(reg.id)
          contagem[reg.id] = rs.length
        }),
      )
      setRespostasPorHist(contagem)
    } catch {
      setHistorico([])
      setFechamentos([])
    }
  }, [item.id])

  useEffect(() => {
    carregarHistoricos()
  }, [carregarHistoricos, item.etapa_atual, item.resultado])

  const falha = (titulo: string, err: unknown) =>
    toast({
      title: titulo,
      description: err instanceof Error ? err.message : 'Ocorreu uma falha inesperada.',
      variant: 'destructive',
    })

  // trilha gravada; se ainda não gravada, a prevista pelo produto (definida no 1º salvamento)
  const trilha = item.trilha || trilhaDoProduto(item.expand?.produto?.complexidade)
  const lista = etapasDaTrilha(etapas, trilha)
  const atual = lista.find((e) => e.id === item.etapa_atual)
  const proxima = etapaVizinha(etapas, trilha, item.etapa_atual, 1)
  const anterior = etapaVizinha(etapas, trilha, item.etapa_atual, -1)
  const fechada = item.resultado === 'ganha' || item.resultado === 'perdida'
  const valorNumero = valor.trim() === '' ? null : Number(valor.replace(',', '.'))
  const derivado = derivarFechamento(ambiente)
  const passo = proximoPasso({
    trilha,
    etapaAtualNome: atual?.nome,
    proximaEtapaNome: proxima?.nome,
    resultado: item.resultado,
    ambiente: item.ambiente_fechamento,
    valor: item.valor_estimado,
  })
  // o que falta (pelo que está SALVO) para poder mudar de etapa
  const faltandoParaMover = atual
    ? camposFaltantesParaMover(item.ambiente_fechamento, item.valor_estimado)
    : []
  const bloqueadoPorFechamento = faltandoParaMover.length > 0
  const histAberto = historico.find((h) => !h.saiu_em && h.etapa === item.etapa_atual)
  const itensEtapa = useMemo(
    () => itensChecklist.filter((i) => i.etapa === item.etapa_atual),
    [itensChecklist, item.etapa_atual],
  )
  const alertas = insucessosMarcados(itensEtapa, marcados)
  const criterios = resumoCriterios(itensEtapa, marcados)

  const salvarFechamento = async () => {
    if (valorNumero !== null && (Number.isNaN(valorNumero) || valorNumero < 0)) {
      toast({
        title: 'Valor estimado inválido',
        description: 'Informe um número maior ou igual a zero.',
        variant: 'destructive',
      })
      return
    }
    setSalvando(true)
    try {
      const atualizado = await oportunidadesService.salvarFechamento(item.id, ambiente, valorNumero)
      toast({ title: 'Fechamento atualizado' })
      onAtualizado(atualizado)
    } catch (err) {
      falha('Não foi possível salvar o fechamento', err)
    } finally {
      setSalvando(false)
    }
  }

  const mover = async (etapaId: string, titulo: string) => {
    setSalvando(true)
    try {
      const atualizado = await oportunidadesService.moverEtapa(item.id, etapaId)
      toast({ title: titulo })
      onAtualizado(atualizado)
      await carregarHistoricos()
    } catch (err) {
      falha('Não foi possível mudar a etapa', err)
    } finally {
      setSalvando(false)
    }
  }

  const abrirConclusao = () => {
    setMarcados({})
    setObservacoes({})
    setAlertaConfirmado(false)
    setConcluindo(true)
  }

  // concluir etapa = gravar o checklist no registro da etapa e avançar para a próxima
  const concluirEtapa = async () => {
    if (!proxima) return
    if (alertas.length > 0 && !alertaConfirmado) {
      setAlertaConfirmado(true) // mostra o alerta; a confirmação exige um segundo clique
      return
    }
    setSalvando(true)
    try {
      if (histAberto && itensEtapa.length > 0) {
        await oportunidadesService.salvarChecklist(
          histAberto.id,
          itensEtapa.map((i) => ({
            item: i.id,
            marcado: i.tipo === 'pergunta' ? !!(observacoes[i.id] || '').trim() : !!marcados[i.id],
            observacao: observacoes[i.id],
          })),
        )
      }
      const atualizado = await oportunidadesService.moverEtapa(item.id, proxima.id)
      toast({ title: `Etapa concluída — a oportunidade seguiu para “${proxima.nome}”` })
      setConcluindo(false)
      onAtualizado(atualizado)
      await carregarHistoricos()
    } catch (err) {
      falha('Não foi possível concluir a etapa', err)
    } finally {
      setSalvando(false)
    }
  }

  const registrarResultado = async () => {
    if (!modoResultado) return
    setSalvando(true)
    try {
      let atualizado: OportunidadeRecord
      if (modoResultado === 'reabrir') {
        atualizado = await oportunidadesService.reabrir(item.id, motivo)
        toast({ title: 'Oportunidade reaberta' })
      } else {
        atualizado = await oportunidadesService.registrarResultado(
          item.id,
          modoResultado,
          motivo,
          concorrente,
        )
        toast({ title: modoResultado === 'ganha' ? 'Oportunidade ganha' : 'Oportunidade perdida' })
      }
      setModoResultado(null)
      setMotivo('')
      setConcorrente('')
      onAtualizado(atualizado)
      await carregarHistoricos()
    } catch (err) {
      falha('Não foi possível registrar', err)
    } finally {
      setSalvando(false)
    }
  }

  const grupos: { tipo: ChecklistItemRecord['tipo']; titulo: string }[] = [
    { tipo: 'criterio', titulo: 'Critérios de conclusão' },
    { tipo: 'pergunta', titulo: 'Perguntas de reflexão' },
    { tipo: 'insucesso', titulo: 'Sinais de insucesso (marque se estiverem presentes)' },
  ]

  const destaqueFechamento = !fechada && !!atual && bloqueadoPorFechamento

  return (
    <div className="space-y-6">
      {/* Próximo passo — o que fazer agora, em destaque */}
      <div className="rounded-2xl border-2 border-[#DE6464]/40 bg-[#DE6464]/[0.06] p-5 lg:p-6 flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-[#DE6464] text-white flex items-center justify-center shrink-0">
          <Compass className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-[#DE6464]">Próximo passo</p>
          <p className="text-lg lg:text-xl font-semibold text-[#030507] mt-1 leading-snug">
            {passo.texto}
          </p>
        </div>
      </div>

      {/* Pipeline na horizontal */}
      <div className={cartaoCls}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
          <p className={tituloCls}>
            <Flag className="w-5 h-5 text-[#DE6464]" /> Pipeline
          </p>
          {trilha && <p className="text-sm text-[#6B7280]">{rotuloTrilha(trilha)}</p>}
        </div>
        {!trilha ? (
          <p className="text-base rounded-xl bg-amber-50 border border-amber-200 text-[#92400E] px-4 py-3">
            Trilha não definida: o produto desta oportunidade precisa ter a complexidade (baixa ou
            alta) cadastrada no catálogo para iniciar o pipeline.
          </p>
        ) : (
          <ol className="flex gap-2 overflow-x-auto pb-1">
            {lista.map((etapa) => {
              const eAtual = etapa.id === item.etapa_atual
              const concluida = !!atual && etapa.ordem < atual.ordem
              return (
                <li
                  key={etapa.id}
                  className={`flex-1 min-w-[140px] rounded-xl border-2 px-3 py-3 ${
                    eAtual
                      ? 'border-[#DE6464] bg-[#DE6464] text-white shadow-md'
                      : concluida
                        ? 'border-emerald-200 bg-emerald-50 text-[#065F46]'
                        : 'border-[#E5E7EB] bg-white text-[#6B7280]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
                        eAtual
                          ? 'bg-white text-[#DE6464]'
                          : concluida
                            ? 'bg-emerald-500 text-white'
                            : 'bg-gray-100 text-[#6B7280]'
                      }`}
                    >
                      {concluida ? <Check className="w-4 h-4" /> : etapa.ordem}
                    </span>
                    <span className={`text-xs ${eAtual ? 'text-white/85' : ''}`}>{etapa.fase}</span>
                  </div>
                  <p className="text-sm font-semibold mt-2 leading-snug">{etapa.nome}</p>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Coluna principal: etapa atual + checklist + histórico */}
        <div className="xl:col-span-2 space-y-6">
          {trilha && (
            <div className={cartaoCls}>
              <p className={tituloCls}>
                <ClipboardCheck className="w-5 h-5 text-[#DE6464]" />
                {atual ? `Etapa atual: ${atual.nome}` : 'Pipeline ainda não iniciado'}
              </p>
              {atual && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl bg-[#FAF7F2] px-4 py-3">
                    <p className="text-sm text-[#6B7280]">Na etapa desde</p>
                    <p className="text-base font-semibold text-[#030507]">
                      {formatarDataHora(item.etapa_desde) || '—'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#FAF7F2] px-4 py-3">
                    <p className="text-sm text-[#6B7280]">Responsável sugerido</p>
                    <p className="text-base font-semibold text-[#030507]">
                      {atual.responsavel_sugerido || '—'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#FAF7F2] px-4 py-3">
                    <p className="text-sm text-[#6B7280]">Duração de referência</p>
                    <p className="text-base font-semibold text-[#030507]">{atual.duracao || '—'}</p>
                  </div>
                </div>
              )}

              {/* Conclusão da etapa com checklist */}
              {concluindo && proxima && (
                <div className="mt-5 rounded-2xl border border-[#E5E7EB] bg-[#FAF7F2] p-5 space-y-5">
                  <p className="text-base font-bold text-[#030507]">
                    Concluir “{atual?.nome}” e seguir para “{proxima.nome}”
                  </p>
                  {itensEtapa.length === 0 ? (
                    <p className="text-base text-[#6B7280]">
                      O checklist desta etapa ainda não foi cadastrado. Você pode concluir a etapa
                      normalmente.
                    </p>
                  ) : (
                    grupos.map((g) => {
                      const itens = itensEtapa.filter((i) => i.tipo === g.tipo)
                      if (itens.length === 0) return null
                      return (
                        <div key={g.tipo} className="space-y-2">
                          <p className="text-base font-semibold text-[#030507]">
                            {g.titulo}
                            {g.tipo === 'criterio' &&
                              ` — ${criterios.atendidos} de ${criterios.total} atendidos`}
                          </p>
                          {g.tipo === 'pergunta' ? (
                            <div className="space-y-3">
                              {itens.map((i) => (
                                <div key={i.id}>
                                  <p className="text-base text-[#374151] mb-1.5">{i.texto}</p>
                                  <textarea
                                    rows={2}
                                    value={observacoes[i.id] || ''}
                                    onChange={(e) =>
                                      setObservacoes((o) => ({ ...o, [i.id]: e.target.value }))
                                    }
                                    className={campoCls}
                                    placeholder="Resposta (opcional)."
                                  />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {itens.map((i) => (
                                <label
                                  key={i.id}
                                  className={`flex items-start gap-3 rounded-xl border bg-white px-4 py-3 text-base cursor-pointer transition-colors ${
                                    marcados[i.id]
                                      ? g.tipo === 'insucesso'
                                        ? 'border-red-300 bg-red-50'
                                        : 'border-emerald-300 bg-emerald-50'
                                      : 'border-[#E5E7EB] hover:border-[#D1D5DB]'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-1 w-5 h-5 accent-[#DE6464] shrink-0"
                                    checked={!!marcados[i.id]}
                                    onChange={(e) => {
                                      setMarcados((m) => ({ ...m, [i.id]: e.target.checked }))
                                      setAlertaConfirmado(false)
                                    }}
                                  />
                                  <span className="text-[#374151]">{i.texto}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                  {alertaConfirmado && alertas.length > 0 && (
                    <div className="rounded-xl bg-red-50 border border-red-200 text-[#991B1B] px-4 py-3 text-base space-y-1.5">
                      <p className="font-semibold flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" /> Atenção: sinais de insucesso presentes
                      </p>
                      <ul className="list-disc pl-6">
                        {alertas.map((a) => (
                          <li key={a.id}>{a.texto}</li>
                        ))}
                      </ul>
                      <p>
                        Revise antes de seguir. Se decidir avançar, o alerta fica registrado no
                        histórico.
                      </p>
                    </div>
                  )}
                  <div className="flex flex-wrap justify-end gap-3">
                    <Button
                      variant="ghost"
                      size="lg"
                      onClick={() => setConcluindo(false)}
                      disabled={salvando}
                    >
                      Cancelar
                    </Button>
                    <Button size="lg" onClick={concluirEtapa} disabled={salvando}>
                      {salvando
                        ? 'Registrando…'
                        : alertaConfirmado && alertas.length > 0
                          ? `Avançar mesmo assim para “${proxima.nome}”`
                          : `Confirmar e seguir para “${proxima.nome}”`}
                    </Button>
                  </div>
                </div>
              )}

              {!concluindo && !fechada && (
                <div className="mt-5 flex flex-col gap-3">
                  {bloqueadoPorFechamento && (
                    <p className="rounded-xl bg-amber-50 border border-amber-200 text-[#92400E] px-4 py-3 text-base">
                      Para mudar de etapa, preencha e salve na seção Fechamento:{' '}
                      <strong>{faltandoParaMover.join(' e ')}</strong>.
                    </p>
                  )}
                  <div className="flex flex-wrap justify-end gap-3">
                    {!atual && lista[0] && (
                      <Button
                        size="lg"
                        onClick={() => mover(lista[0].id, 'Pipeline iniciado')}
                        disabled={salvando}
                      >
                        Iniciar pipeline
                      </Button>
                    )}
                    {anterior && (
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={() =>
                          mover(anterior.id, `Oportunidade voltou para “${anterior.nome}”`)
                        }
                        disabled={salvando || bloqueadoPorFechamento}
                      >
                        <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar etapa
                      </Button>
                    )}
                    {proxima && (
                      <Button
                        size="lg"
                        onClick={abrirConclusao}
                        disabled={salvando || bloqueadoPorFechamento}
                      >
                        <ClipboardCheck className="w-4 h-4 mr-1.5" /> Concluir etapa
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Históricos */}
          <div className={cartaoCls}>
            <p className={`${tituloCls} mb-4`}>
              <History className="w-5 h-5 text-[#DE6464]" /> Histórico
            </p>
            {historico.length === 0 && fechamentos.length === 0 ? (
              <p className="text-base text-[#6B7280]">Nenhuma movimentação registrada ainda.</p>
            ) : (
              <ol className="relative border-l-2 border-[#E5E7EB] ml-2 space-y-5">
                {historico.map((h) => (
                  <li key={h.id} className="pl-5 relative">
                    <span className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-white border-2 border-[#DE6464]" />
                    <p className="text-base font-semibold text-[#030507]">
                      {h.expand?.etapa?.nome || 'Etapa removida'}
                    </p>
                    <p className="text-sm text-[#6B7280]">
                      Entrou em {formatarDataHora(h.entrou_em)}
                      {h.saiu_em ? ` · saiu em ${formatarDataHora(h.saiu_em)}` : ' · etapa atual'}
                      {h.expand?.responsavel
                        ? ` · por ${h.expand.responsavel.name || h.expand.responsavel.email}`
                        : ''}
                      {respostasPorHist[h.id]
                        ? ` · checklist com ${respostasPorHist[h.id]} ${respostasPorHist[h.id] === 1 ? 'item registrado' : 'itens registrados'}`
                        : ''}
                    </p>
                  </li>
                ))}
                {fechamentos.map((f) => (
                  <li key={f.id} className="pl-5 relative">
                    <span className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-white border-2 border-[#030507]" />
                    <p className="text-base font-semibold text-[#030507]">
                      {f.acao === 'reabertura'
                        ? 'Oportunidade reaberta'
                        : f.resultado === 'ganha'
                          ? 'Oportunidade ganha'
                          : 'Oportunidade perdida'}
                    </p>
                    <p className="text-sm text-[#6B7280]">
                      {formatarDataHora(f.registrado_em)} — {f.motivo}
                      {f.concorrente ? ` (concorrente: ${f.concorrente})` : ''}
                      {f.expand?.registrado_por
                        ? ` · por ${f.expand.registrado_por.name || f.expand.registrado_por.email}`
                        : ''}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* Coluna lateral: lead, fechamento e resultado sempre à vista */}
        <div className="space-y-6">
          {lateral}

          {/* Fechamento */}
          <div
            className={`${cartaoCls} space-y-4 ${
              destaqueFechamento ? 'ring-2 ring-[#F59E0B] border-[#F59E0B]' : ''
            }`}
          >
            <p className={tituloCls}>
              <Wallet className="w-5 h-5 text-[#DE6464]" /> Fechamento
            </p>
            {destaqueFechamento && (
              <p className="text-sm font-semibold text-[#92400E]">
                Preencha estes campos para liberar a mudança de etapa.
              </p>
            )}
            <div>
              <label className={rotuloCls}>Ambiente de fechamento</label>
              <select
                value={ambiente}
                onChange={(e) => setAmbiente(e.target.value as AmbienteFechamento | '')}
                className={campoCls}
                disabled={fechada}
              >
                <option value="">Selecione</option>
                <option value="Venda em reais">Venda em reais</option>
                <option value="Locação em reais">Locação em reais</option>
                <option value="Exportação (EUA)">Exportação (EUA)</option>
              </select>
            </div>
            <div>
              <label className={rotuloCls}>
                Valor estimado{derivado.moeda ? ` (${derivado.moeda})` : ''}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                className={campoCls}
                disabled={fechada}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#FAF7F2] px-3 py-2.5">
                <p className="text-sm text-[#6B7280]">Moeda</p>
                <p className="text-base font-semibold text-[#030507]">{derivado.moeda || '—'}</p>
              </div>
              <div className="rounded-xl bg-[#FAF7F2] px-3 py-2.5">
                <p className="text-sm text-[#6B7280]">Entidade vendedora</p>
                <p className="text-base font-semibold text-[#030507]">{derivado.entidade || '—'}</p>
              </div>
            </div>
            <p className="text-sm text-[#6B7280]">
              Moeda e entidade são definidas automaticamente pelo ambiente de fechamento.
            </p>
            {!fechada && (
              <Button className="w-full" size="lg" onClick={salvarFechamento} disabled={salvando}>
                {salvando ? 'Salvando…' : 'Salvar fechamento'}
              </Button>
            )}
          </div>

          {/* Resultado: ganha / perdida / reabrir */}
          <div className={`${cartaoCls} space-y-4`}>
            <p className={tituloCls}>
              <Trophy className="w-5 h-5 text-[#DE6464]" /> Resultado
            </p>
            {fechada ? (
              <div className="text-base text-[#374151] space-y-1">
                <p
                  className={`text-xl font-bold ${item.resultado === 'ganha' ? 'text-[#059669]' : 'text-[#B91C1C]'}`}
                >
                  {item.resultado === 'ganha' ? 'Ganha' : 'Perdida'}
                  {item.valor_estimado
                    ? ` · ${formatarValor(item.valor_estimado, item.moeda)}`
                    : ''}
                </p>
                {item.fechado_em && <p>Em {formatarDataHora(item.fechado_em)}</p>}
                {item.resultado_motivo && <p>{item.resultado_motivo}</p>}
                {item.concorrente && <p>Concorrente: {item.concorrente}</p>}
              </div>
            ) : (
              <p className="text-base text-[#6B7280]">
                Em andamento. Registre o resultado quando a negociação terminar — é preciso informar
                o motivo e ter o fechamento (ambiente e valor) preenchido.
              </p>
            )}

            {modoResultado ? (
              <div className="space-y-3">
                <label className={rotuloCls}>
                  {modoResultado === 'reabrir'
                    ? 'Justificativa da reabertura (obrigatória)'
                    : modoResultado === 'ganha'
                      ? 'Motivo do ganho (obrigatório)'
                      : 'Motivo da perda (obrigatório)'}
                </label>
                <textarea
                  rows={3}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className={campoCls}
                />
                {modoResultado === 'perdida' && (
                  <input
                    type="text"
                    value={concorrente}
                    onChange={(e) => setConcorrente(e.target.value)}
                    placeholder="Concorrente que venceu (opcional)"
                    className={campoCls}
                  />
                )}
                <div className="flex justify-end gap-3">
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={() => setModoResultado(null)}
                    disabled={salvando}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="lg"
                    onClick={registrarResultado}
                    disabled={salvando || !motivo.trim()}
                  >
                    {salvando ? 'Registrando…' : 'Confirmar'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {fechada ? (
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => {
                      setMotivo('')
                      setModoResultado('reabrir')
                    }}
                  >
                    <RotateCcw className="w-4 h-4 mr-1.5" /> Reabrir oportunidade
                  </Button>
                ) : (
                  <>
                    <Button
                      size="lg"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => {
                        setMotivo('')
                        setModoResultado('ganha')
                      }}
                    >
                      <Trophy className="w-4 h-4 mr-1.5" /> Registrar ganho
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="text-[#B91C1C]"
                      onClick={() => {
                        setMotivo('')
                        setConcorrente('')
                        setModoResultado('perdida')
                      }}
                    >
                      <ThumbsDown className="w-4 h-4 mr-1.5" /> Registrar perda
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
