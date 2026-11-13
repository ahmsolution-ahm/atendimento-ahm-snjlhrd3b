import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Flag, History, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { oportunidadesService } from '@/services/oportunidades'
import {
  camposFaltantesParaMover,
  derivarFechamento,
  etapaVizinha,
  etapasDaTrilha,
  formatarValor,
  rotuloTrilha,
  trilhaDoProduto,
} from '@/lib/pipeline'
import type {
  AmbienteFechamento,
  OportunidadeEtapaRecord,
  OportunidadeRecord,
  PipelineEtapaRecord,
} from '@/types'

// F2-T02/T03/T04 — fechamento, pipeline de duas trilhas e histórico de passagem por etapa.
// O servidor valida tudo (trilha, campos obrigatórios, histórico); a tela mostra o resultado
// e as mensagens do servidor. AP-2026-11-11-0600: o efeito aparece onde o usuário está.

const formatarDataHora = (valor?: string) => {
  if (!valor) return ''
  const d = new Date(valor.replace(' ', 'T'))
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

const campoCls =
  'w-full px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm text-[#030507] bg-white outline-none focus:border-[#DE6464]'

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
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    setAmbiente(item.ambiente_fechamento || '')
    setValor(item.valor_estimado && item.valor_estimado > 0 ? String(item.valor_estimado) : '')
  }, [item.id, item.ambiente_fechamento, item.valor_estimado])

  const carregarHistorico = useCallback(async () => {
    try {
      setHistorico(await oportunidadesService.historico(item.id))
    } catch {
      setHistorico([])
    }
  }, [item.id])

  useEffect(() => {
    carregarHistorico()
  }, [carregarHistorico, item.etapa_atual])

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
  const valorNumero = valor.trim() === '' ? null : Number(valor.replace(',', '.'))
  const derivado = derivarFechamento(ambiente)
  const faltandoSalvo = camposFaltantesParaMover(item.ambiente_fechamento, item.valor_estimado)

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
      await carregarHistorico()
    } catch (err) {
      falha('Não foi possível mudar a etapa', err)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Fechamento */}
      <div className="rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm space-y-3">
        <p className="font-medium flex items-center gap-1.5">
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
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Moeda: <span className="font-semibold text-[#030507]">{derivado.moeda || '—'}</span> ·
          Entidade vendedora:{' '}
          <span className="font-semibold text-[#030507]">{derivado.entidade || '—'}</span>{' '}
          (definidas automaticamente pelo ambiente de fechamento)
        </p>
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={salvarFechamento} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar fechamento'}
          </Button>
        </div>
      </div>

      {/* Pipeline */}
      <div className="rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm space-y-3">
        <p className="font-medium flex items-center gap-1.5">
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
            {atual && item.etapa_desde && (
              <p className="text-xs text-muted-foreground">
                Na etapa “{atual.nome}” desde {formatarDataHora(item.etapa_desde)}.
              </p>
            )}
            {atual && faltandoSalvo.length > 0 && (
              <p className="text-xs rounded-lg bg-amber-50 border border-amber-200 text-[#92400E] px-3 py-2">
                Para mudar de etapa, preencha e salve na seção Fechamento:{' '}
                {faltandoSalvo.join(' e ')}.
              </p>
            )}
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
                  onClick={() => mover(anterior.id, `Oportunidade voltou para “${anterior.nome}”`)}
                  disabled={salvando}
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Voltar etapa
                </Button>
              )}
              {proxima && (
                <Button
                  size="sm"
                  onClick={() => mover(proxima.id, `Oportunidade avançou para “${proxima.nome}”`)}
                  disabled={salvando}
                >
                  Avançar para “{proxima.nome}” <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Histórico de etapas */}
      {historico.length > 0 && (
        <div className="rounded-lg border border-[#E5E7EB] bg-white p-3 text-sm">
          <p className="font-medium flex items-center gap-1.5 mb-2">
            <History className="w-4 h-4 text-[#DE6464]" /> Histórico de etapas
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
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {item.valor_estimado && item.valor_estimado > 0 ? (
        <p className="text-xs text-muted-foreground text-right">
          Valor estimado salvo: {formatarValor(item.valor_estimado, item.moeda)}
        </p>
      ) : null}
    </div>
  )
}
