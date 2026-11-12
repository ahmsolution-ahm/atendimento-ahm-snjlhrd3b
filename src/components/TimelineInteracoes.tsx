import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, Plus, FileCheck2, Ban, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { interacoesService, calcularAteProposta, TIPOS_INTERACAO } from '@/services/interacoes'
import type { InteracaoRecord, InteracaoTipo } from '@/types'

// F1-T19/T20/T21 — timeline de interações do lead até a proposta.
// Cada ação grava na hora (independente do "Salvar" do modal de edição) e recarrega a lista.

const hojeISO = () => {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

const formatarData = (valor?: string) => {
  if (!valor) return ''
  const d = new Date(valor.replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR')
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

const inputCls =
  'w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] bg-white outline-none focus:border-[#DE6464]'

type Acao = { tipo: 'proposta' | 'cancelar'; id: string } | null

export default function TimelineInteracoes({ leadId }: { leadId: string }) {
  const { user } = useAuth()
  const { toast } = useToast()

  const [itens, setItens] = useState<InteracaoRecord[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const [novaAberta, setNovaAberta] = useState(false)
  const [novoTipo, setNovoTipo] = useState<InteracaoTipo>('Ligação')
  const [novaData, setNovaData] = useState(hojeISO())
  const [novaObs, setNovaObs] = useState('')

  const [acao, setAcao] = useState<Acao>(null)
  const [texto, setTexto] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      setItens(await interacoesService.listarPorLead(leadId))
    } catch {
      toast({
        title: 'Erro ao carregar interações',
        description: 'Não foi possível carregar a timeline deste lead.',
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }, [leadId, toast])

  useEffect(() => {
    carregar()
  }, [carregar])

  const falha = (titulo: string, err: unknown) =>
    toast({
      title: titulo,
      description: err instanceof Error ? err.message : 'Ocorreu uma falha inesperada.',
      variant: 'destructive',
    })

  const registrar = async () => {
    setSalvando(true)
    try {
      await interacoesService.criar({
        lead: leadId,
        tipo: novoTipo,
        data: novaData,
        observacao: novaObs,
        responsavel: user?.id,
      })
      toast({ title: 'Interação registrada' })
      setNovaAberta(false)
      setNovaObs('')
      setNovaData(hojeISO())
      await carregar()
    } catch (err) {
      falha('Não foi possível registrar a interação', err)
    } finally {
      setSalvando(false)
    }
  }

  const abrirAcao = (tipo: 'proposta' | 'cancelar', item: InteracaoRecord) => {
    setAcao({ tipo, id: item.id })
    setTexto(tipo === 'proposta' ? item.observacao || '' : '')
  }

  const confirmarAcao = async (item: InteracaoRecord) => {
    if (!acao) return
    setSalvando(true)
    try {
      if (acao.tipo === 'proposta') {
        await interacoesService.marcarProposta(item, texto)
        toast({ title: 'Proposta marcada' })
      } else {
        await interacoesService.cancelar(item.id, texto)
        toast({ title: 'Interação cancelada' })
      }
      setAcao(null)
      setTexto('')
      await carregar()
    } catch (err) {
      falha(
        acao.tipo === 'proposta'
          ? 'Não foi possível marcar a proposta'
          : 'Não foi possível cancelar a interação',
        err,
      )
    } finally {
      setSalvando(false)
    }
  }

  const ativas = itens.filter((i) => !i.cancelada).length
  const ateProposta = calcularAteProposta(itens)

  return (
    <div className="mt-6 pt-5 border-t border-[#E5E7EB] space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[#030507] flex items-center gap-1.5">
          <CalendarClock className="w-4 h-4 text-[#DE6464]" />
          Timeline de interações
        </h3>
        {!novaAberta && (
          <button
            type="button"
            onClick={() => setNovaAberta(true)}
            className="px-3 py-1.5 rounded-xl text-[11px] font-semibold text-[#030507] bg-white border border-[#E5E7EB] shadow-sm hover:bg-[#FAF7F2] flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Registrar interação
          </button>
        )}
      </div>

      {/* Contagem até a proposta (exclui canceladas) */}
      <p className="text-xs rounded-xl bg-[#FAF7F2] border border-[#E5E7EB] px-3 py-2 text-[#374151]">
        {carregando
          ? 'Carregando…'
          : ateProposta !== null
            ? `Interações até a proposta: ${ateProposta}.`
            : `Sem proposta registrada — ${plural(ativas, 'interação', 'interações')} até agora.`}
      </p>

      {/* Formulário de nova interação */}
      {novaAberta && (
        <div className="rounded-xl border border-[#E5E7EB] p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#030507] mb-1">
                Tipo
              </label>
              <select
                value={novoTipo}
                onChange={(e) => setNovoTipo(e.target.value as InteracaoTipo)}
                className={inputCls}
              >
                {TIPOS_INTERACAO.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#030507] mb-1">
                Data
              </label>
              <input
                type="date"
                value={novaData}
                max={hojeISO()}
                onChange={(e) => setNovaData(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#030507] mb-1">
              Observação (opcional)
            </label>
            <textarea
              value={novaObs}
              onChange={(e) => setNovaObs(e.target.value)}
              rows={2}
              placeholder="Resumo do que foi tratado."
              className={inputCls}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setNovaAberta(false)}
              disabled={salvando}
              className="px-3 py-1.5 rounded-xl text-[11px] font-medium text-[#6B7280]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={registrar}
              disabled={salvando || !novaData}
              className="px-4 py-1.5 rounded-xl text-[11px] font-semibold text-white shadow-md disabled:opacity-50"
              style={{ backgroundColor: '#DE6464' }}
            >
              {salvando ? 'Registrando…' : 'Registrar'}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {!carregando && itens.length === 0 && (
        <p className="text-xs text-[#6B7280]">
          Nenhuma interação registrada. Registre ligações, reuniões e demais contatos com este lead
          até a proposta.
        </p>
      )}
      {carregando && (
        <p className="text-xs text-[#6B7280] flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Carregando interações…
        </p>
      )}

      <ul className="space-y-2">
        {itens.map((i) => (
          <li
            key={i.id}
            className={`rounded-xl border p-3 text-xs ${
              i.cancelada
                ? 'border-[#E5E7EB] bg-gray-50 text-[#9CA3AF]'
                : 'border-[#E5E7EB] bg-white text-[#374151]'
            }`}
          >
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className={`font-semibold ${i.cancelada ? 'line-through' : 'text-[#030507]'}`}>
                {i.tipo}
              </span>
              <span>· {formatarData(i.data)}</span>
              {i.expand?.responsavel && (
                <span>· {i.expand.responsavel.name || i.expand.responsavel.email}</span>
              )}
              {i.proposta && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 border border-emerald-200 text-[#059669]">
                  Proposta
                </span>
              )}
              {i.cancelada && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 border border-gray-200 text-[#6B7280]">
                  Cancelada
                </span>
              )}
            </div>
            {i.observacao && <p className="whitespace-pre-line">{i.observacao}</p>}
            {i.cancelada && (
              <p className="mt-1 text-[11px]">
                Motivo do cancelamento: {i.cancelada_motivo}
                {i.cancelada_em && ` (em ${formatarData(i.cancelada_em)}`}
                {i.cancelada_em &&
                  (i.expand?.cancelada_por
                    ? ` por ${i.expand.cancelada_por.name || i.expand.cancelada_por.email})`
                    : ')')}
              </p>
            )}

            {/* Ação em andamento nesta interação */}
            {acao?.id === i.id ? (
              <div className="mt-2 space-y-1.5">
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  rows={2}
                  placeholder={
                    acao.tipo === 'proposta'
                      ? 'Descreva o que foi proposto (obrigatório).'
                      : 'Informe o motivo do cancelamento (obrigatório).'
                  }
                  className={inputCls}
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAcao(null)}
                    disabled={salvando}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-medium text-[#6B7280]"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmarAcao(i)}
                    disabled={salvando || !texto.trim()}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-semibold text-white shadow-md disabled:opacity-50"
                    style={{ backgroundColor: acao.tipo === 'proposta' ? '#059669' : '#DE6464' }}
                  >
                    {salvando
                      ? 'Registrando…'
                      : acao.tipo === 'proposta'
                        ? 'Confirmar proposta'
                        : 'Confirmar cancelamento'}
                  </button>
                </div>
              </div>
            ) : (
              !i.cancelada && (
                <div className="mt-2 flex justify-end gap-1.5">
                  {!i.proposta && (
                    <button
                      type="button"
                      onClick={() => abrirAcao('proposta', i)}
                      disabled={salvando}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#059669] bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1"
                    >
                      <FileCheck2 className="w-3.5 h-3.5" />
                      Marcar proposta
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => abrirAcao('cancelar', i)}
                    disabled={salvando}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#6B7280] bg-white border border-[#E5E7EB] hover:bg-[#FAF7F2] flex items-center gap-1"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Cancelar interação
                  </button>
                </div>
              )
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
