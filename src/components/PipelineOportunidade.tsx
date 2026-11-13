import { useCallback, useEffect, useMemo, useState } from 'react'
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
// e históricos. Fluxo guiado (pedido do owner): o cartão "Próximo passo" diz, em linguagem
// simples, o que fazer agora. O servidor valida tudo; a tela mostra as mensagens dele.

const formatarDataHora = (valor?: string) => {
  if (!valor) return ''
  const d = new Date(valor.replace(' ', 'T'))
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

const campoCls =
  'w-full px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm text-[#030507] bg-white outline-none focus:border-[#DE6464]'
const caixaCls = 'rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm space-y-3'
const tituloCls = 'font-medium flex items-center gap-1.5'

export default function PipelineOportunidade({
  item,
  etapas,
  onAtualizado,
}: {
  item: OportunidadeRecord
  etapas: PipelineEtapaRecord[]
  onAtualizado: (item: OportunidadeRecord) => void
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

  return (
    <div className="space-y-4">
      {/* Próximo passo — o que fazer agora */}
      <div className="rounded-lg border border-[#DE6464]/30 bg-[#DE6464]/5 p-3 text-sm">
        <p className={`${tituloCls} text-[#030507] mb-1`}>
          <Compass className="w-4 h-4 text-[#DE6464]" /> Próximo passo
        </p>
        <p className="text-[#374151]">{passo.texto}</p>
      </div>

      {/* Pipeline */}
      <div className={caixaCls}>
        <p className={tituloCls}>
          <Flag className="w-4 h-4 text-[#DE6464]" /> Pipeline
        </p>
        {!trilha ? (
          <p className="text-xs rounded-lg bg-amber-50 border border-amber-200 text-[#92400E] px-3 py-2">
            Trilha não definida: o produto desta oportunidade precisa ter a complexidade (baixa ou
            alta) cadastrada no catálogo para iniciar o pipeline.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{rotuloTrilha(trilha)}</p>
            <ol className="space-y-1">
              {lista.map((etapa) => {
                const eAtual = etapa.id === item.etapa_atual
                const concluida = !!atual && etapa.ordem < atual.ordem
                return (
                  <li
                    key={etapa.id}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
                      eAtual
                        ? 'bg-[#DE6464] text-white font-semibold'
                        : concluida
                          ? 'bg-emerald-50 text-[#065F46]'
                          : 'text-[#6B7280]'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        eAtual
                          ? 'bg-white text-[#DE6464]'
                          : concluida
                            ? 'bg-emerald-500 text-white'
                            : 'bg-gray-100 text-[#6B7280]'
                      }`}
                    >
                      {concluida ? <Check className="w-3 h-3" /> : etapa.ordem}
                    </span>
                    <span className="flex-1">{etapa.nome}</span>
                    <span className={`text-[10px] ${eAtual ? 'text-white/80' : ''}`}>
                      {etapa.fase}
                    </span>
                  </li>
                )
              })}
            </ol>
            {atual && (
              <p className="text-xs text-muted-foreground">
                {item.etapa_desde &&
                  `Na etapa “${atual.nome}” desde ${formatarDataHora(item.etapa_desde)}.`}
                {atual.responsavel_sugerido &&
                  ` Responsável sugerido: ${atual.responsavel_sugerido}.`}
                {atual.duracao && ` Duração de referência: ${atual.duracao}.`}
              </p>
            )}

            {/* Conclusão da etapa com checklist */}
            {concluindo && proxima && (
              <div className="rounded-lg border border-[#E5E7EB] bg-[#FAF7F2] p-3 space-y-3">
                <p className={tituloCls}>
                  <ClipboardCheck className="w-4 h-4 text-[#DE6464]" /> Concluir “{atual?.nome}”
                </p>
                {itensEtapa.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    O checklist desta etapa ainda não foi cadastrado. Você pode concluir a etapa
                    normalmente.
                  </p>
                ) : (
                  grupos.map((g) => {
                    const itens = itensEtapa.filter((i) => i.tipo === g.tipo)
                    if (itens.length === 0) return null
                    return (
                      <div key={g.tipo} className="space-y-1.5">
                        <p className="text-xs font-semibold text-[#030507]">
                          {g.titulo}
                          {g.tipo === 'criterio' &&
                            ` — ${criterios.atendidos} de ${criterios.total} atendidos`}
                        </p>
                        {itens.map((i) =>
                          i.tipo === 'pergunta' ? (
                            <div key={i.id}>
                              <p className="text-xs text-[#374151] mb-1">{i.texto}</p>
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
                          ) : (
                            <label
                              key={i.id}
                              className="flex items-start gap-2 text-xs text-[#374151]"
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={!!marcados[i.id]}
                                onChange={(e) => {
                                  setMarcados((m) => ({ ...m, [i.id]: e.target.checked }))
                                  setAlertaConfirmado(false)
                                }}
                              />
                              {i.texto}
                            </label>
                          ),
                        )}
                      </div>
                    )
                  })
                )}
                {alertaConfirmado && alertas.length > 0 && (
                  <div className="rounded-lg bg-red-50 border border-red-200 text-[#991B1B] px-3 py-2 text-xs space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Atenção: sinais de insucesso
                      presentes
                    </p>
                    <ul className="list-disc pl-5">
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
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConcluindo(false)}
                    disabled={salvando}
                  >
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={concluirEtapa} disabled={salvando}>
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
              <div className="flex flex-wrap justify-end gap-2">
                {!atual && lista[0] && (
                  <Button
                    size="sm"
                    onClick={() => mover(lista[0].id, 'Pipeline iniciado')}
                    disabled={salvando}
                  >
                    Iniciar pipeline
                  </Button>
                )}
                {anterior && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      mover(anterior.id, `Oportunidade voltou para “${anterior.nome}”`)
                    }
                    disabled={salvando}
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Voltar etapa
                  </Button>
                )}
                {proxima && (
                  <Button size="sm" onClick={abrirConclusao} disabled={salvando}>
                    <ClipboardCheck className="w-3.5 h-3.5 mr-1" /> Concluir etapa
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Fechamento */}
      <div className={caixaCls}>
        <p className={tituloCls}>
          <Wallet className="w-4 h-4 text-[#DE6464]" /> Fechamento
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              Ambiente de fechamento
            </label>
            <select
              value={ambiente}
              onChange={(e) => setAmbiente(e.target.value as AmbienteFechamento | '')}
              className={campoCls}
              disabled={fechada}
            >
              <option value="">— selecione</option>
              <option value="Venda em reais">Venda em reais</option>
              <option value="Locação em reais">Locação em reais</option>
              <option value="Exportação (EUA)">Exportação (EUA)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
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
        </div>
        <p className="text-xs text-muted-foreground">
          Moeda: <span className="font-semibold text-[#030507]">{derivado.moeda || '—'}</span> ·
          Entidade vendedora:{' '}
          <span className="font-semibold text-[#030507]">{derivado.entidade || '—'}</span>{' '}
          (definidas automaticamente pelo ambiente de fechamento)
        </p>
        {!fechada && (
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={salvarFechamento} disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar fechamento'}
            </Button>
          </div>
        )}
      </div>

      {/* Resultado: ganha / perdida / reabrir */}
      <div className={caixaCls}>
        <p className={tituloCls}>
          <Trophy className="w-4 h-4 text-[#DE6464]" /> Resultado
        </p>
        {fechada ? (
          <p className="text-xs text-[#374151]">
            <span
              className={`font-semibold ${item.resultado === 'ganha' ? 'text-[#059669]' : 'text-[#B91C1C]'}`}
            >
              {item.resultado === 'ganha' ? 'Ganha' : 'Perdida'}
            </span>
            {item.fechado_em && ` em ${formatarDataHora(item.fechado_em)}`}
            {item.resultado_motivo && ` — ${item.resultado_motivo}`}
            {item.concorrente && ` (concorrente: ${item.concorrente})`}
            {item.valor_estimado ? ` · ${formatarValor(item.valor_estimado, item.moeda)}` : ''}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Em andamento. Registre o resultado quando a negociação terminar — é preciso informar o
            motivo e ter o fechamento (ambiente e valor) preenchido.
          </p>
        )}

        {modoResultado ? (
          <div className="space-y-2">
            <label className="block text-xs text-muted-foreground">
              {modoResultado === 'reabrir'
                ? 'Justificativa da reabertura (obrigatória)'
                : modoResultado === 'ganha'
                  ? 'Motivo do ganho (obrigatório)'
                  : 'Motivo da perda (obrigatório)'}
            </label>
            <textarea
              rows={2}
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
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setModoResultado(null)}
                disabled={salvando}
              >
                Cancelar
              </Button>
              <Button size="sm" onClick={registrarResultado} disabled={salvando || !motivo.trim()}>
                {salvando ? 'Registrando…' : 'Confirmar'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap justify-end gap-2">
            {fechada ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setMotivo('')
                  setModoResultado('reabrir')
                }}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reabrir oportunidade
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-[#B91C1C]"
                  onClick={() => {
                    setMotivo('')
                    setConcorrente('')
                    setModoResultado('perdida')
                  }}
                >
                  <ThumbsDown className="w-3.5 h-3.5 mr-1" /> Registrar perda
                </Button>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    setMotivo('')
                    setModoResultado('ganha')
                  }}
                >
                  <Trophy className="w-3.5 h-3.5 mr-1" /> Registrar ganho
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Históricos */}
      {(historico.length > 0 || fechamentos.length > 0) && (
        <div className="rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm">
          <p className={`${tituloCls} mb-2`}>
            <History className="w-4 h-4 text-[#DE6464]" /> Histórico
          </p>
          <ul className="space-y-1.5 text-xs">
            {historico.map((h) => (
              <li key={h.id} className="flex flex-col">
                <span className="font-semibold text-[#030507]">
                  {h.expand?.etapa?.nome || 'Etapa removida'}
                </span>
                <span className="text-muted-foreground">
                  Entrou em {formatarDataHora(h.entrou_em)}
                  {h.saiu_em ? ` · saiu em ${formatarDataHora(h.saiu_em)}` : ' · etapa atual'}
                  {h.expand?.responsavel
                    ? ` · por ${h.expand.responsavel.name || h.expand.responsavel.email}`
                    : ''}
                  {respostasPorHist[h.id]
                    ? ` · checklist com ${respostasPorHist[h.id]} ${respostasPorHist[h.id] === 1 ? 'item registrado' : 'itens registrados'}`
                    : ''}
                </span>
              </li>
            ))}
            {fechamentos.map((f) => (
              <li key={f.id} className="flex flex-col">
                <span className="font-semibold text-[#030507]">
                  {f.acao === 'reabertura'
                    ? 'Oportunidade reaberta'
                    : f.resultado === 'ganha'
                      ? 'Oportunidade ganha'
                      : 'Oportunidade perdida'}
                </span>
                <span className="text-muted-foreground">
                  {formatarDataHora(f.registrado_em)} — {f.motivo}
                  {f.concorrente ? ` (concorrente: ${f.concorrente})` : ''}
                  {f.expand?.registrado_por
                    ? ` · por ${f.expand.registrado_por.name || f.expand.registrado_por.email}`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
