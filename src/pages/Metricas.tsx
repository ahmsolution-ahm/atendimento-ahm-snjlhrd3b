import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { BarChart3, Bot, Repeat, Users, Copy, Database, Trash2, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import {
  metricasService,
  type DadosK1,
  type DadosK3,
  type DadosPipeline,
  type DiasMetricas,
} from '@/services/metricas'
import PainelPipeline from '@/components/PainelPipeline'
import { demonstracaoService, ORIGEM_DEMO } from '@/services/demonstracao'
import {
  AMOSTRA_MINIMA_K1,
  META_K1,
  META_K2,
  REFERENCIA_K2,
  inicioDoPeriodo,
  juntarFiltros,
  plural,
  type ResultadoK2,
} from '@/lib/metricas'

// F1-T17 — SPEC 1.6 (CA-1-016..018): painel mínimo dos indicadores do projeto.
// Nomes de negócio na tela (os códigos K1/K2/K3 ficam só no código e na documentação).

const PERIODOS = [
  { rotulo: 'Últimos 7 dias', dias: 7 },
  { rotulo: 'Últimos 30 dias', dias: 30 },
  { rotulo: 'Últimos 90 dias', dias: 90 },
  { rotulo: 'Todo o período', dias: null },
] as const

const FONTES = [
  { rotulo: 'Todas as fontes', valor: 'todas' },
  { rotulo: 'Cadastro manual', valor: 'manual' },
  { rotulo: 'Importação CSV', valor: 'csv' },
  // F2-T09: origem "LP" (Landing Page) como fatia própria; "Outras" fecha a soma com o total
  { rotulo: 'Landing Page', valor: 'lp' },
  { rotulo: 'Demonstração', valor: 'demo' },
  { rotulo: 'Outras origens', valor: 'outras' },
] as const
type Fonte = (typeof FONTES)[number]['valor']

// AP-2026-11-11-0545: a tela monta a expressão completa do filtro antes do service
const filtroFonte = (fonte: Fonte, campo: string): string => {
  switch (fonte) {
    case 'manual':
      return `${campo} = ''`
    case 'csv':
      return `${campo} = 'Importação CSV'`
    case 'demo':
      return `${campo} = '${ORIGEM_DEMO}'`
    case 'lp':
      return `${campo} = 'LP'`
    case 'outras':
      return `${campo} != '' && ${campo} != 'Importação CSV' && ${campo} != 'LP' && ${campo} != '${ORIGEM_DEMO}'`
    default:
      return ''
  }
}

const cardCls = 'bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5 flex flex-col gap-3'
const chipCls = (ativo: boolean) =>
  `px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
    ativo
      ? 'bg-[#DE6464] text-white shadow-sm'
      : 'bg-white text-[#374151] border border-[#E5E7EB] hover:bg-[#F3F4F6]'
  }`

function Insuficiente({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs rounded-xl bg-amber-50 border border-amber-200 text-[#92400E] px-3 py-2">
      {children}
    </p>
  )
}

export default function Metricas() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [dias, setDias] = useState<number | null>(30)
  const [fonte, setFonte] = useState<Fonte>('todas')
  const [carregando, setCarregando] = useState(true)
  const [k1, setK1] = useState<DadosK1 | null>(null)
  const [k2, setK2] = useState<ResultadoK2 | null>(null)
  const [k3, setK3] = useState<DadosK3 | null>(null)
  const [pipeline, setPipeline] = useState<DadosPipeline | null>(null)

  const [qtdDemo, setQtdDemo] = useState(0)
  const [processandoDemo, setProcessandoDemo] = useState(false)

  const rotuloPeriodo = PERIODOS.find((p) => p.dias === dias)?.rotulo || 'Todo o período'
  const rotuloFonte = FONTES.find((f) => f.valor === fonte)?.rotulo || 'Todas as fontes'

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const inicio = inicioDoPeriodo(dias)
      const filtroLeads = juntarFiltros(
        inicio ? `created >= '${inicio}'` : '',
        filtroFonte(fonte, 'origem'),
      )
      const filtroPropostas = juntarFiltros(
        inicio ? `data >= '${inicio}'` : '',
        filtroFonte(fonte, 'lead.origem'),
      )
      const [r1, r2, r3, demo, pip] = await Promise.all([
        metricasService.qualificacaoAutomatica(filtroLeads),
        metricasService.interacoesAteProposta(filtroPropostas),
        metricasService.capacidadePorVendedor(dias as DiasMetricas, fonte),
        demonstracaoService.quantidade(),
        metricasService.pipeline(inicio),
      ])
      setK1(r1)
      setK2(r2)
      setK3(r3)
      setQtdDemo(demo)
      setPipeline(pip)
    } catch {
      toast({
        title: 'Erro ao carregar métricas',
        description: 'Não foi possível calcular os indicadores. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }, [dias, fonte, toast])

  useEffect(() => {
    carregar()
  }, [carregar])

  const carregarDemo = async () => {
    if (!user?.id) return
    setProcessandoDemo(true)
    try {
      const n = await demonstracaoService.carregar(user.id)
      toast({
        title: 'Demonstração carregada',
        description: `${plural(n, 'lead de demonstração criado', 'leads de demonstração criados')}.`,
      })
      await carregar()
    } catch (err) {
      toast({
        title: 'Não foi possível carregar a demonstração',
        description: err instanceof Error ? err.message : 'Ocorreu uma falha inesperada.',
        variant: 'destructive',
      })
    } finally {
      setProcessandoDemo(false)
    }
  }

  const removerDemo = async () => {
    if (!window.confirm('Remover todos os dados de demonstração? Os dados reais não são afetados.'))
      return
    setProcessandoDemo(true)
    try {
      const n = await demonstracaoService.remover()
      toast({
        title: 'Demonstração removida',
        description: `${plural(n, 'lead de demonstração removido', 'leads de demonstração removidos')}, com as oportunidades, transbordos e interações vinculados.`,
      })
      await carregar()
    } catch (err) {
      toast({
        title: 'Não foi possível remover a demonstração',
        description: err instanceof Error ? err.message : 'Ocorreu uma falha inesperada.',
        variant: 'destructive',
      })
    } finally {
      setProcessandoDemo(false)
    }
  }

  const copiarResumo = async () => {
    const linhas = [
      `Indicadores — ${rotuloPeriodo} · ${rotuloFonte}`,
      `Qualificação automática: ${k1?.percentual ?? '—'}% (${k1?.numerador ?? 0} de ${k1?.denominador ?? 0} leads do recorte piloto; meta ${META_K1}%)`,
      `Interações até a proposta: ${k2?.media ?? '—'} (média de ${k2?.leadsComProposta ?? 0} leads com proposta; referência ${REFERENCIA_K2}, meta até ${META_K2})`,
      `Capacidade por vendedor: ${k3?.mediaPorVendedor ?? '—'} leads processados por vendedor (${k3?.totalProcessados ?? 0} no total; ${k3?.semResponsavel ?? 0} sem responsável)`,
    ]
    try {
      await navigator.clipboard.writeText(linhas.join('\n'))
      toast({ title: 'Resumo copiado' })
    } catch {
      toast({
        title: 'Não foi possível copiar',
        description: 'O navegador bloqueou o acesso à área de transferência.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-[#030507]">
            <BarChart3 className="w-6 h-6" />
            Métricas
          </h1>
          <p className="text-sm text-[#6B7280]">
            Indicadores do projeto calculados a partir dos leads, qualificações e interações
            registrados no sistema.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => carregar()}
            disabled={carregando}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-[#030507] bg-white border border-[#E5E7EB] shadow-sm hover:bg-[#FAF7F2] flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <button
            type="button"
            onClick={copiarResumo}
            disabled={carregando}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-[#030507] bg-white border border-[#E5E7EB] shadow-sm hover:bg-[#FAF7F2] flex items-center gap-1.5 disabled:opacity-50"
          >
            <Copy className="w-3.5 h-3.5" />
            Copiar resumo
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {PERIODOS.map((p) => (
            <button
              key={p.rotulo}
              type="button"
              onClick={() => setDias(p.dias)}
              className={chipCls(dias === p.dias)}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
        <select
          value={fonte}
          onChange={(e) => setFonte(e.target.value as Fonte)}
          className="px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] bg-white outline-none focus:border-[#DE6464] sm:ml-auto"
        >
          {FONTES.map((f) => (
            <option key={f.valor} value={f.valor}>
              {f.rotulo}
            </option>
          ))}
        </select>
      </div>
      <p className="text-[11px] text-[#6B7280] -mt-3">
        Período: {rotuloPeriodo} (pela data de entrada do lead; nas propostas, pela data da
        proposta) · Fonte: {rotuloFonte}
      </p>

      {/* Indicadores */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Qualificação automática */}
        <div className={cardCls}>
          <div className="flex items-center gap-2 text-sm font-bold text-[#030507]">
            <Bot className="w-4 h-4 text-[#DE6464]" />
            Qualificação automática
          </div>
          <p className="text-3xl font-extrabold text-[#030507]">
            {carregando ? '…' : k1?.percentual !== null && k1 ? `${k1.percentual}%` : '—'}
          </p>
          <p className="text-xs text-[#374151]">
            {k1
              ? `${k1.numerador} de ${plural(k1.denominador, 'lead', 'leads')} do recorte piloto qualificados sem intervenção humana.`
              : ''}{' '}
            Meta: {META_K1}% ou mais.
          </p>
          {k1 && !carregando && k1.denominador === 0 && (
            <Insuficiente>
              Nenhum lead do recorte piloto no período. Cadastre ou importe leads com produto de
              baixa complexidade.
            </Insuficiente>
          )}
          {k1 && !carregando && k1.denominador > 0 && !k1.suficiente && (
            <Insuficiente>
              Amostra pequena: o percentual fica representativo a partir de {AMOSTRA_MINIMA_K1}{' '}
              leads do recorte piloto.
            </Insuficiente>
          )}
          <div className="text-[11px] text-[#6B7280] space-y-0.5 border-t border-[#F3F4F6] pt-2">
            <p>Cálculo: qualificados automaticamente ÷ leads recebidos no recorte piloto.</p>
            <p>Recorte piloto: leads com produto de interesse de baixa complexidade.</p>
            {k1 && (
              <>
                <p>Qualificados manualmente no recorte: {k1.qualificadosManual}.</p>
                <p>
                  Leads sem produto (ainda fora do cálculo): {k1.semProduto.toLocaleString('pt-BR')}
                  .
                </p>
              </>
            )}
          </div>
        </div>

        {/* Interações até a proposta */}
        <div className={cardCls}>
          <div className="flex items-center gap-2 text-sm font-bold text-[#030507]">
            <Repeat className="w-4 h-4 text-[#DE6464]" />
            Interações até a proposta
          </div>
          <p className="text-3xl font-extrabold text-[#030507]">
            {carregando ? '…' : k2?.media !== null && k2 ? k2.media.toLocaleString('pt-BR') : '—'}
          </p>
          <p className="text-xs text-[#374151]">
            {k2 && k2.leadsComProposta > 0
              ? `Média de ${plural(k2.leadsComProposta, 'lead', 'leads')} com proposta registrada.`
              : ''}{' '}
            Referência atual: cerca de {REFERENCIA_K2}. Meta: até {META_K2}.
          </p>
          {k2 && !carregando && k2.leadsComProposta === 0 && (
            <Insuficiente>
              Nenhuma proposta registrada no período. Registre as interações e marque a proposta na
              timeline do lead (tela Leads → Editar).
            </Insuficiente>
          )}
          <div className="text-[11px] text-[#6B7280] space-y-0.5 border-t border-[#F3F4F6] pt-2">
            <p>
              Cálculo: média, entre os leads com proposta, das interações humanas registradas até a
              proposta.
            </p>
            <p>Interações canceladas não entram na conta.</p>
          </div>
        </div>

        {/* Capacidade por vendedor */}
        <div className={cardCls}>
          <div className="flex items-center gap-2 text-sm font-bold text-[#030507]">
            <Users className="w-4 h-4 text-[#DE6464]" />
            Capacidade por vendedor
          </div>
          <p className="text-3xl font-extrabold text-[#030507]">
            {carregando
              ? '…'
              : k3?.mediaPorVendedor !== null && k3
                ? k3.mediaPorVendedor.toLocaleString('pt-BR')
                : '—'}
          </p>
          <p className="text-xs text-[#374151]">
            Leads processados por vendedor no período
            {k3 ? ` (${k3.totalProcessados.toLocaleString('pt-BR')} no total).` : '.'}
          </p>
          {k3 && !carregando && k3.vendedores.length === 0 && (
            <Insuficiente>
              Nenhum lead processado com responsável no período. Atribua um responsável aos leads
              para medir a capacidade.
            </Insuficiente>
          )}
          {k3 && k3.vendedores.length > 0 && (
            <ul className="text-xs text-[#374151] space-y-1">
              {k3.vendedores.map((v) => (
                <li key={v.id} className="flex justify-between gap-2">
                  <span className="truncate">{v.nome}</span>
                  <span className="font-semibold">{v.processados.toLocaleString('pt-BR')}</span>
                </li>
              ))}
            </ul>
          )}
          {k3 && k3.semResponsavel > 0 && (
            <Insuficiente>
              {plural(k3.semResponsavel, 'lead processado está', 'leads processados estão')} sem
              responsável e não entram na conta.
            </Insuficiente>
          )}
          <div className="text-[11px] text-[#6B7280] space-y-0.5 border-t border-[#F3F4F6] pt-2">
            <p>Processado: lead que passou pela qualificação (rascunhos não contam).</p>
            <p>
              Meta: 1,3 vez a capacidade anterior. A comparação depende do número de referência a
              ser informado pela AHM.
            </p>
          </div>
        </div>
      </div>

      {/* Fase 2 · Bloco 2: taxas de passagem real × alvo e taxa de vitória */}
      <PainelPipeline dados={pipeline} carregando={carregando} />

      {/* Demonstração */}
      <div className="bg-white rounded-2xl border border-dashed border-[#D1D5DB] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Database className="w-5 h-5 text-[#6B7280] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-[#030507]">Dados de demonstração</p>
            <p className="text-xs text-[#6B7280] max-w-xl">
              Carrega 10 leads fictícios do recorte piloto, qualificados pelo motor e registrados
              como qualificação automática, com interações até a proposta — para ver o painel
              funcionando. Ficam identificados como “DEMO” e podem ser removidos a qualquer momento,
              sem afetar os dados reais.
            </p>
            <p className="text-xs font-semibold text-[#374151] mt-1">
              {qtdDemo > 0
                ? `Carregados: ${plural(qtdDemo, 'lead de demonstração', 'leads de demonstração')}.`
                : 'Nenhum dado de demonstração carregado.'}
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {qtdDemo === 0 ? (
            <button
              type="button"
              onClick={carregarDemo}
              disabled={processandoDemo || carregando}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-md disabled:opacity-50 flex items-center gap-1.5"
              style={{ backgroundColor: '#DE6464' }}
            >
              <Database className="w-3.5 h-3.5" />
              {processandoDemo ? 'Carregando…' : 'Carregar demonstração'}
            </button>
          ) : (
            <button
              type="button"
              onClick={removerDemo}
              disabled={processandoDemo || carregando}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#030507] bg-white border border-[#E5E7EB] shadow-sm hover:bg-[#FAF7F2] disabled:opacity-50 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {processandoDemo ? 'Removendo…' : 'Remover demonstração'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
