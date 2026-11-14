import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Clock,
  Filter,
  Handshake,
  RefreshCw,
  Settings,
  Target,
  TrendingUp,
  Trophy,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import {
  desempenhoService,
  type DadosDesempenho,
  type MotivoPerdaRecord,
  type PeriodoDesempenho,
  type TrilhaDesempenho,
} from '@/services/desempenho'
import { metricasService, type DadosPipeline } from '@/services/metricas'
import { usersService } from '@/services/users'
import PainelPipeline from '@/components/PainelPipeline'
import { META_TAXA_VITORIA, formatarValor } from '@/lib/pipeline'
import { plural } from '@/lib/metricas'
import type { UserRecord } from '@/types'

// Fase 2 · Bloco C — Desempenho: réplica dos relatórios do Pipedrive do owner, alimentada pelas
// oportunidades do CRM (agregação no servidor). Regras de leitura:
// - valores sempre separados por moeda (R$ e US$ nunca são somados);
// - estado vazio honesto: sem dados no período, o gráfico diz isso (nenhum número inventado);
// - vendedor vê os próprios números (o servidor força); administrador escolhe o recorte.
// Cores: barra única = coral AHM; ganha/perdida = verde/vermelho com rótulo (paleta validada
// para daltonismo); destaque "em negociação" = coral × cinza neutro, com legenda.

const CORAL = '#DE6464'
const NEUTRO = '#CBD5E1'
const GANHA = '#059669'
const PERDIDA = '#B91C1C'
const TINTA = '#030507'
const TINTA_2 = '#6B7280'

const PERIODOS: { rotulo: string; valor: PeriodoDesempenho }[] = [
  { rotulo: 'Mês atual', valor: 'mes' },
  { rotulo: 'Últimos 3 meses', valor: '3m' },
  { rotulo: 'Últimos 6 meses', valor: '6m' },
  { rotulo: 'Últimos 12 meses', valor: '12m' },
  { rotulo: 'Todo o período', valor: 'todos' },
]

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const rotuloMes = (m: string) => `${MESES[parseInt(m.slice(5, 7), 10) - 1]}/${m.slice(2, 4)}`

const brl = (v: number) => formatarValor(v, 'BRL')
const usd = (v: number) => formatarValor(v, 'USD')

// valores por moeda em texto, sem nunca somar moedas diferentes
const textoMoedas = (BRL: number, USD: number) => {
  const partes: string[] = []
  if (BRL > 0) partes.push(brl(BRL))
  if (USD > 0) partes.push(usd(USD))
  return partes.length > 0 ? partes.join(' · ') : 'Sem valor definido'
}

const cartaoCls = 'bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5 lg:p-6'

function Cartao({
  titulo,
  icone,
  descricao,
  children,
  className = '',
}: {
  titulo: string
  icone?: ReactNode
  descricao?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`${cartaoCls} ${className}`}>
      <p className="text-lg font-bold text-[#030507] flex items-center gap-2">
        {icone}
        {titulo}
      </p>
      {descricao && <p className="text-sm text-[#6B7280] mt-1">{descricao}</p>}
      <div className="mt-4">{children}</div>
    </div>
  )
}

function Vazio({ texto = 'Sem dados no período escolhido.' }: { texto?: string }) {
  return (
    <div className="h-full min-h-[160px] flex items-center justify-center rounded-xl bg-[#FAF7F2] border border-dashed border-[#E5E7EB] px-6 text-center text-base text-[#6B7280]">
      {texto}
    </div>
  )
}

function Destaque({
  rotulo,
  valor,
  detalhe,
  icone,
}: {
  rotulo: string
  valor: string
  detalhe?: string
  icone: ReactNode
}) {
  return (
    <div className={`${cartaoCls} flex flex-col gap-2`}>
      <div className="flex items-center justify-between text-[#6B7280]">
        <span className="text-base font-semibold">{rotulo}</span>
        <span className="w-10 h-10 rounded-xl bg-[#DE6464]/10 text-[#DE6464] flex items-center justify-center">
          {icone}
        </span>
      </div>
      <p className="text-3xl font-extrabold text-[#030507] leading-tight">{valor}</p>
      {detalhe && <p className="text-sm text-[#6B7280]">{detalhe}</p>}
    </div>
  )
}

// tooltip padrão: fundo escuro, texto em tinta clara (nunca na cor da série)
function Dica({ linhas }: { linhas: string[] }) {
  return (
    <div className="bg-[#030507] text-white px-3 py-2 rounded-xl shadow-xl text-sm space-y-0.5">
      {linhas.map((l, i) => (
        <p key={i} className={i === 0 ? 'font-semibold' : ''}>
          {l}
        </p>
      ))}
    </div>
  )
}

const eixo = { fill: TINTA_2, fontSize: 13 }

// barras horizontais (nomes longos de etapa/motivo) — uma série, sem legenda
function BarrasHorizontais({
  dados,
  rotulo,
  dica,
  cor = () => CORAL,
}: {
  dados: { nome: string; valor: number }[]
  rotulo: (v: number) => string
  dica: (d: { nome: string; valor: number }) => string[]
  cor?: (d: { nome: string; valor: number }) => string
}) {
  const altura = Math.max(160, dados.length * 40 + 30)
  return (
    <div style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 56, left: 8, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="#F3F4F6" />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={eixo}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="nome"
            width={210}
            tick={eixo}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(222,100,100,0.06)' }}
            content={({ active, payload }) =>
              active && payload && payload.length ? (
                <Dica linhas={dica(payload[0].payload as { nome: string; valor: number })} />
              ) : null
            }
          />
          <Bar
            dataKey="valor"
            radius={[0, 4, 4, 0]}
            barSize={22}
            label={{
              position: 'right',
              fill: TINTA,
              fontSize: 13,
              formatter: (v: unknown) => rotulo(Number(v)),
            }}
          >
            {dados.map((d, i) => (
              <Cell key={i} fill={cor(d)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function Desempenho() {
  const { isAdmin, user } = useAuth()
  const { toast } = useToast()

  const [periodo, setPeriodo] = useState<PeriodoDesempenho>('12m')
  const [trilha, setTrilha] = useState<TrilhaDesempenho>('todas')
  const [responsavel, setResponsavel] = useState('todos')
  const [usuarios, setUsuarios] = useState<UserRecord[]>([])
  const [dados, setDados] = useState<DadosDesempenho | null>(null)
  const [pipeline, setPipeline] = useState<DadosPipeline | null>(null)
  const [carregando, setCarregando] = useState(true)

  // configurações do administrador
  const [mostrarConfig, setMostrarConfig] = useState(false)
  const [meta, setMeta] = useState<{ id: string; valor: number } | null>(null)
  const [metaTexto, setMetaTexto] = useState('')
  const [motivos, setMotivos] = useState<MotivoPerdaRecord[]>([])

  useEffect(() => {
    if (!isAdmin) return
    usersService
      .list()
      .then(setUsuarios)
      .catch(() => setUsuarios([]))
  }, [isAdmin])

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const d = await desempenhoService.carregar(periodo, trilha, responsavel)
      setDados(d)
      const inicio = d.filtros.inicio ? d.filtros.inicio.slice(0, 10) + ' 00:00:00' : null
      metricasService
        .pipeline(inicio)
        .then(setPipeline)
        .catch(() => setPipeline(null))
    } catch (err) {
      toast({
        title: 'Erro ao carregar o desempenho',
        description: err instanceof Error ? err.message : 'Tente novamente em instantes.',
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }, [periodo, trilha, responsavel, toast])

  useEffect(() => {
    carregar()
  }, [carregar])

  const abrirConfig = async () => {
    setMostrarConfig((v) => !v)
    if (mostrarConfig) return
    try {
      const [m, lista] = await Promise.all([
        desempenhoService.lerMeta(),
        desempenhoService.motivosPerda(false),
      ])
      setMeta(m)
      setMetaTexto(m ? String(m.valor) : '')
      setMotivos(lista)
    } catch {
      toast({ title: 'Não foi possível carregar as configurações', variant: 'destructive' })
    }
  }

  const salvarMeta = async () => {
    const n = Number(metaTexto)
    if (!meta || !Number.isInteger(n) || n < 0) {
      toast({
        title: 'Meta inválida',
        description: 'Informe um número inteiro maior ou igual a zero.',
        variant: 'destructive',
      })
      return
    }
    try {
      await desempenhoService.salvarMeta(meta.id, n)
      setMeta({ ...meta, valor: n })
      toast({ title: 'Meta atualizada' })
      carregar()
    } catch (err) {
      toast({
        title: 'Não foi possível salvar a meta',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  const alternarMotivo = async (m: MotivoPerdaRecord) => {
    try {
      await desempenhoService.alternarMotivo(m.id, !m.ativo)
      setMotivos((lista) => lista.map((x) => (x.id === m.id ? { ...x, ativo: !m.ativo } : x)))
      toast({ title: m.ativo ? 'Motivo desativado' : 'Motivo ativado' })
    } catch (err) {
      toast({
        title: 'Não foi possível alterar o motivo',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  const porMes = useMemo(
    () => (dados?.porMes || []).map((m) => ({ ...m, rotulo: rotuloMes(m.mes) })),
    [dados],
  )
  const temCriadas = porMes.some((m) => m.criadas > 0)
  const temGanhas = porMes.some((m) => m.ganhas > 0)
  const etapasPorTrilha = useMemo(() => {
    const lista = dados?.abertasPorEtapa || []
    return {
      alta: lista.filter((e) => e.trilha === 'alta'),
      baixa: lista.filter((e) => e.trilha === 'baixa'),
    }
  }, [dados])
  const fechadas = (dados?.ganhas.qtd || 0) + (dados?.perdidas || 0)
  const funilMax = Math.max(1, ...(dados?.funil || []).map((f) => f.qtd))
  const nomeRecorte = !isAdmin
    ? `Seus números${user?.name ? ` (${user.name})` : ''}`
    : responsavel === 'todos'
      ? 'Time inteiro'
      : responsavel === 'sem'
        ? 'Oportunidades sem responsável'
        : usuarios.find((u) => u.id === responsavel)?.name || 'Responsável escolhido'

  const graficoEtapas = (titulo: string, lista: DadosDesempenho['abertasPorEtapa']) => {
    const linhas = lista.map((e) => ({
      nome: `${e.ordem}. ${e.nome}`,
      valor: e.qtd,
      negociacao: e.negociacao,
      BRL: e.BRL,
      USD: e.USD,
    }))
    return (
      <div className="space-y-2">
        <p className="text-base font-semibold text-[#030507]">{titulo}</p>
        {linhas.every((l) => l.valor === 0) ? (
          <Vazio texto="Nenhuma oportunidade aberta nesta trilha." />
        ) : (
          <BarrasHorizontais
            dados={linhas}
            rotulo={(v) => (v > 0 ? String(v) : '')}
            cor={(d) => ((d as (typeof linhas)[number]).negociacao ? CORAL : NEUTRO)}
            dica={(d) => {
              const l = d as (typeof linhas)[number]
              return [
                l.nome,
                plural(l.valor, 'oportunidade aberta', 'oportunidades abertas'),
                textoMoedas(l.BRL, l.USD),
              ]
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold flex items-center gap-3 text-[#030507]">
            <TrendingUp className="w-7 h-7 text-[#DE6464]" /> Desempenho
          </h1>
          <p className="text-base text-[#6B7280] mt-1">
            {nomeRecorte} · valores em reais e em dólares sempre separados · dados de demonstração
            não entram.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="lg" onClick={carregar} disabled={carregando}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${carregando ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
          {isAdmin && (
            <Button variant="outline" size="lg" onClick={abrirConfig}>
              <Settings className="w-4 h-4 mr-1.5" /> Configurações
            </Button>
          )}
        </div>
      </div>

      {/* Filtros (uma linha, acima dos gráficos) */}
      <div className={`${cartaoCls} flex flex-col xl:flex-row xl:items-center gap-4`}>
        <span className="flex items-center gap-2 text-base font-semibold text-[#374151]">
          <Filter className="w-4 h-4" /> Filtros
        </span>
        <div className="flex flex-wrap gap-2">
          {PERIODOS.map((p) => (
            <button
              key={p.valor}
              type="button"
              onClick={() => setPeriodo(p.valor)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                periodo === p.valor
                  ? 'bg-[#DE6464] text-white shadow-sm'
                  : 'bg-white text-[#374151] border border-[#E5E7EB] hover:bg-[#F3F4F6]'
              }`}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 xl:ml-auto">
          <select
            value={trilha}
            onChange={(e) => setTrilha(e.target.value as TrilhaDesempenho)}
            className="px-3.5 py-2.5 rounded-xl border border-[#E5E7EB] text-base bg-white outline-none focus:border-[#DE6464]"
          >
            <option value="todas">Todas as trilhas</option>
            <option value="alta">Alta complexidade (Site Assessment)</option>
            <option value="baixa">Baixa complexidade (AHM Cycle)</option>
          </select>
          {isAdmin && (
            <select
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl border border-[#E5E7EB] text-base bg-white outline-none focus:border-[#DE6464]"
            >
              <option value="todos">Time inteiro</option>
              <option value="sem">Sem responsável</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Configurações do administrador */}
      {isAdmin && mostrarConfig && (
        <div className={`${cartaoCls} space-y-5`}>
          <p className="text-lg font-bold text-[#030507] flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#DE6464]" /> Configurações do administrador
          </p>
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div>
              <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                Meta do time: negócios criados por mês
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={metaTexto}
                onChange={(e) => setMetaTexto(e.target.value)}
                className="w-40 px-3.5 py-2.5 rounded-xl border border-[#E5E7EB] text-base outline-none focus:border-[#DE6464]"
              />
            </div>
            <Button size="lg" onClick={salvarMeta} disabled={!meta}>
              Salvar meta
            </Button>
          </div>
          <div>
            <p className="text-base font-semibold text-[#030507] mb-2">
              Motivos de perda disponíveis no fechamento
            </p>
            <p className="text-sm text-[#6B7280] mb-3">
              Desativar um motivo o tira da lista de escolha; os fechamentos antigos com ele são
              mantidos.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {motivos.map((m) => (
                <label
                  key={m.id}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-base cursor-pointer ${
                    m.ativo
                      ? 'border-[#E5E7EB] bg-white'
                      : 'border-dashed border-[#D1D5DB] bg-[#F9FAFB] text-[#6B7280]'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="w-5 h-5 accent-[#DE6464]"
                    checked={!!m.ativo}
                    onChange={() => alternarMotivo(m)}
                  />
                  <span>
                    {m.nome}
                    {m.exige_detalhe ? ' — exige observação' : ''}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {!dados ? (
        <Vazio
          texto={
            carregando ? 'Calculando os indicadores…' : 'Não foi possível carregar os indicadores.'
          }
        />
      ) : (
        <>
          {/* Destaques */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
            <Destaque
              rotulo="Em negociação"
              valor={String(dados.negociacao.qtd)}
              detalhe={textoMoedas(dados.negociacao.BRL, dados.negociacao.USD)}
              icone={<Handshake className="w-5 h-5" />}
            />
            <Destaque
              rotulo="Abertas no pipeline"
              valor={String(dados.abertas.qtd)}
              detalhe={textoMoedas(dados.abertas.BRL, dados.abertas.USD)}
              icone={<Target className="w-5 h-5" />}
            />
            <Destaque
              rotulo="Ganhas no período"
              valor={String(dados.ganhas.qtd)}
              detalhe={textoMoedas(dados.ganhas.BRL, dados.ganhas.USD)}
              icone={<Trophy className="w-5 h-5" />}
            />
            <Destaque
              rotulo="Taxa de vitória"
              valor={
                dados.taxaVitoria === null ? '—' : `${dados.taxaVitoria.toLocaleString('pt-BR')}%`
              }
              detalhe={
                fechadas > 0
                  ? `${plural(dados.ganhas.qtd, 'ganha', 'ganhas')} de ${plural(fechadas, 'fechada', 'fechadas')} · meta ${META_TAXA_VITORIA}%`
                  : `Sem fechamentos no período · meta ${META_TAXA_VITORIA}%`
              }
              icone={<TrendingUp className="w-5 h-5" />}
            />
            <Destaque
              rotulo="Ticket médio das ganhas"
              valor={
                dados.ticketMedio.BRL === null && dados.ticketMedio.USD === null
                  ? '—'
                  : dados.ticketMedio.BRL !== null
                    ? brl(dados.ticketMedio.BRL)
                    : usd(dados.ticketMedio.USD || 0)
              }
              detalhe={
                dados.ticketMedio.BRL !== null && dados.ticketMedio.USD !== null
                  ? `Em dólares: ${usd(dados.ticketMedio.USD)}`
                  : dados.ticketMedio.BRL === null && dados.ticketMedio.USD === null
                    ? 'Sem ganhos com valor no período'
                    : undefined
              }
              icone={<Wallet className="w-5 h-5" />}
            />
            <Destaque
              rotulo="Tempo até ganhar"
              valor={
                dados.duracao.ganhas === null
                  ? '—'
                  : `${dados.duracao.ganhas.toLocaleString('pt-BR')} ${dados.duracao.ganhas === 1 ? 'dia' : 'dias'}`
              }
              detalhe={
                dados.duracao.perdidas !== null
                  ? `Até perder: ${dados.duracao.perdidas.toLocaleString('pt-BR')} ${dados.duracao.perdidas === 1 ? 'dia' : 'dias'}`
                  : 'Média da criação ao fechamento'
              }
              icone={<Clock className="w-5 h-5" />}
            />
          </div>

          {/* Criadas × meta  |  Ganhas por mês */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Cartao
              titulo="Negócios criados por mês"
              descricao={`Total no período: ${dados.totalCriadas}. Linha tracejada: meta do time (${dados.meta} por mês).`}
            >
              {!temCriadas ? (
                <Vazio />
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porMes} margin={{ top: 16, right: 16, left: -8, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#F3F4F6" />
                      <XAxis dataKey="rotulo" tick={eixo} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={eixo} axisLine={false} tickLine={false} />
                      <Tooltip
                        cursor={{ fill: 'rgba(222,100,100,0.06)' }}
                        content={({ active, payload }) =>
                          active && payload && payload.length ? (
                            <Dica
                              linhas={[
                                String(payload[0].payload.rotulo),
                                plural(
                                  Number(payload[0].payload.criadas),
                                  'negócio criado',
                                  'negócios criados',
                                ),
                                `Meta: ${payload[0].payload.meta}`,
                              ]}
                            />
                          ) : null
                        }
                      />
                      {dados.meta > 0 && (
                        <ReferenceLine
                          y={dados.meta}
                          stroke={TINTA}
                          strokeDasharray="6 4"
                          strokeWidth={2}
                          label={{
                            value: `Meta ${dados.meta}`,
                            position: 'insideTopRight',
                            fill: TINTA,
                            fontSize: 13,
                          }}
                        />
                      )}
                      <Bar dataKey="criadas" fill={CORAL} radius={[4, 4, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Cartao>

            <Cartao
              titulo="Negócios ganhos por mês"
              descricao="Quantidade por mês do fechamento. Passe o mouse para ver os valores em reais e em dólares."
            >
              {!temGanhas ? (
                <Vazio />
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porMes} margin={{ top: 16, right: 16, left: -8, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#F3F4F6" />
                      <XAxis dataKey="rotulo" tick={eixo} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={eixo} axisLine={false} tickLine={false} />
                      <Tooltip
                        cursor={{ fill: 'rgba(5,150,105,0.06)' }}
                        content={({ active, payload }) =>
                          active && payload && payload.length ? (
                            <Dica
                              linhas={[
                                String(payload[0].payload.rotulo),
                                plural(
                                  Number(payload[0].payload.ganhas),
                                  'negócio ganho',
                                  'negócios ganhos',
                                ),
                                textoMoedas(
                                  Number(payload[0].payload.ganhasBRL),
                                  Number(payload[0].payload.ganhasUSD),
                                ),
                              ]}
                            />
                          ) : null
                        }
                      />
                      <Bar dataKey="ganhas" fill={GANHA} radius={[4, 4, 0, 0]} maxBarSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Cartao>
          </div>

          {/* Em negociação (lista) */}
          <Cartao
            titulo="Negócios na etapa de negociação"
            icone={<Handshake className="w-5 h-5 text-[#DE6464]" />}
            descricao="Etapas “Negociação (prova de conceito)” na alta complexidade e “Proposta Customizada” na baixa. Foto de agora, maiores valores primeiro."
          >
            {dados.emNegociacao.length === 0 ? (
              <Vazio texto="Nenhuma oportunidade em negociação neste momento." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#FAF7F2] text-sm font-semibold text-[#6B7280]">
                    <tr>
                      <th className="py-3 px-4">Lead</th>
                      <th className="py-3 px-4">Etapa</th>
                      <th className="py-3 px-4">Responsável</th>
                      <th className="py-3 px-4 text-right">Valor estimado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] text-base">
                    {dados.emNegociacao.map((n) => (
                      <tr key={n.id} className="hover:bg-[#FAF7F2]">
                        <td className="py-3 px-4">
                          <Link
                            to={`/oportunidades/${n.id}`}
                            className="font-semibold text-[#030507] hover:text-[#DE6464]"
                          >
                            {n.lead || 'Lead removido'}
                          </Link>
                          {n.empresa && <p className="text-sm text-[#6B7280]">{n.empresa}</p>}
                        </td>
                        <td className="py-3 px-4">{n.etapa}</td>
                        <td className="py-3 px-4">{n.responsavel}</td>
                        <td className="py-3 px-4 text-right font-semibold">
                          {n.moeda ? formatarValor(n.valor, n.moeda) : 'Sem valor definido'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Cartao>

          {/* Abertas por etapa */}
          <Cartao
            titulo="Oportunidades abertas por etapa"
            descricao={`Foto de agora. Barra coral: etapa de negociação; cinza: demais etapas.${dados.naoIniciadas.qtd > 0 ? ` Fora do gráfico: ${plural(dados.naoIniciadas.qtd, 'oportunidade aberta sem pipeline iniciado', 'oportunidades abertas sem pipeline iniciado')}.` : ''}`}
          >
            <div className={`grid grid-cols-1 ${trilha === 'todas' ? 'xl:grid-cols-2' : ''} gap-6`}>
              {(trilha === 'todas' || trilha === 'alta') &&
                graficoEtapas('Site Assessment — alta complexidade', etapasPorTrilha.alta)}
              {(trilha === 'todas' || trilha === 'baixa') &&
                graficoEtapas('AHM Cycle — baixa complexidade', etapasPorTrilha.baixa)}
            </div>
          </Cartao>

          {/* Funil  |  Conversão */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Cartao
              className="xl:col-span-2"
              titulo="Qualificação do funil: pré-venda → comercial"
              descricao="Leads pela data de entrada (sem rascunhos); oportunidades pela data de criação. O percentual compara cada degrau com o anterior."
            >
              {dados.funil.every((f) => f.qtd === 0) ? (
                <Vazio />
              ) : (
                <div className="space-y-3">
                  {dados.funil.map((f, i) => {
                    const anterior = i > 0 ? dados.funil[i - 1].qtd : 0
                    const pct =
                      i > 0 && anterior > 0 ? Math.round((f.qtd / anterior) * 1000) / 10 : null
                    return (
                      <div
                        key={f.etapa}
                        className="grid grid-cols-[200px_1fr_90px] items-center gap-3"
                      >
                        <span className="text-base text-[#374151]">{f.etapa}</span>
                        <div className="h-8 rounded-lg bg-[#F3F4F6] overflow-hidden">
                          <div
                            className="h-full rounded-lg"
                            style={{
                              width: `${Math.max(f.qtd > 0 ? 2 : 0, (f.qtd / funilMax) * 100)}%`,
                              backgroundColor: CORAL,
                            }}
                          />
                        </div>
                        <span className="text-base font-semibold text-[#030507] text-right">
                          {f.qtd.toLocaleString('pt-BR')}
                          {pct !== null && (
                            <span className="block text-sm font-normal text-[#6B7280]">
                              {pct.toLocaleString('pt-BR')}%
                            </span>
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </Cartao>

            <Cartao titulo="Conversão: ganhas × perdidas" descricao="Fechamentos no período.">
              {fechadas === 0 ? (
                <Vazio texto="Sem fechamentos no período." />
              ) : (
                <div className="flex flex-col items-center">
                  <div className="h-56 w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { nome: 'Ganhas', valor: dados.ganhas.qtd },
                            { nome: 'Perdidas', valor: dados.perdidas },
                          ]}
                          dataKey="valor"
                          nameKey="nome"
                          innerRadius={62}
                          outerRadius={90}
                          paddingAngle={2}
                          stroke="#fff"
                          strokeWidth={2}
                        >
                          <Cell fill={GANHA} />
                          <Cell fill={PERDIDA} />
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) =>
                            active && payload && payload.length ? (
                              <Dica linhas={[String(payload[0].name), String(payload[0].value)]} />
                            ) : null
                          }
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-3xl font-extrabold text-[#030507]">
                        {dados.taxaVitoria === null
                          ? '—'
                          : `${dados.taxaVitoria.toLocaleString('pt-BR')}%`}
                      </span>
                      <span className="text-sm text-[#6B7280]">de vitória</span>
                    </div>
                  </div>
                  <div className="flex gap-6 text-base">
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: GANHA }} />{' '}
                      Ganhas: {dados.ganhas.qtd}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: PERDIDA }} />{' '}
                      Perdidas: {dados.perdidas}
                    </span>
                  </div>
                  <p className="text-sm text-[#6B7280] mt-2">
                    Meta de vitória: {META_TAXA_VITORIA}%
                  </p>
                </div>
              )}
            </Cartao>
          </div>

          {/* Perdas por motivo  |  Perdas por etapa */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Cartao
              titulo="Negócios perdidos por motivo"
              descricao="Pela data do fechamento. Perdas anteriores à lista fixa aparecem como “sem classificação”."
            >
              {dados.perdasPorMotivo.length === 0 ? (
                <Vazio texto="Nenhuma perda no período." />
              ) : (
                <BarrasHorizontais
                  dados={dados.perdasPorMotivo.map((p) => ({ nome: p.motivo, valor: p.qtd }))}
                  rotulo={(v) => String(v)}
                  cor={(d) => (d.nome.startsWith('Sem classificação') ? NEUTRO : PERDIDA)}
                  dica={(d) => [d.nome, plural(d.valor, 'negócio perdido', 'negócios perdidos')]}
                />
              )}
            </Cartao>
            <Cartao
              titulo="Negócios perdidos por etapa"
              descricao="Etapa em que a oportunidade estava ao ser perdida."
            >
              {dados.perdasPorEtapa.length === 0 ? (
                <Vazio texto="Nenhuma perda no período." />
              ) : (
                <BarrasHorizontais
                  dados={dados.perdasPorEtapa.map((p) => ({
                    nome: p.ordem
                      ? `${p.trilha === 'alta' ? 'Alta' : 'Baixa'} · ${p.ordem}. ${p.nome}`
                      : p.nome,
                    valor: p.qtd,
                  }))}
                  rotulo={(v) => String(v)}
                  cor={() => PERDIDA}
                  dica={(d) => [d.nome, plural(d.valor, 'negócio perdido', 'negócios perdidos')]}
                />
              )}
            </Cartao>
          </div>

          {/* Tempo por etapa */}
          <Cartao
            titulo="Tempo médio em cada etapa"
            icone={<Clock className="w-5 h-5 text-[#DE6464]" />}
            descricao="Média de dias entre entrar e sair da etapa, nas passagens concluídas do período."
          >
            {dados.tempoPorEtapa.every((t) => t.dias === null) ? (
              <Vazio texto="Nenhuma passagem de etapa concluída no período." />
            ) : (
              <BarrasHorizontais
                dados={dados.tempoPorEtapa
                  .filter((t) => t.dias !== null)
                  .map((t) => ({
                    nome: `${t.trilha === 'alta' ? 'Alta' : 'Baixa'} · ${t.ordem}. ${t.nome}`,
                    valor: t.dias || 0,
                    passagens: t.passagens,
                  }))}
                rotulo={(v) => `${v.toLocaleString('pt-BR')} d`}
                dica={(d) => [
                  d.nome,
                  `${d.valor.toLocaleString('pt-BR')} ${d.valor === 1 ? 'dia' : 'dias'} em média`,
                  plural(
                    (d as { passagens?: number }).passagens || 0,
                    'passagem concluída',
                    'passagens concluídas',
                  ),
                ]}
              />
            )}
          </Cartao>

          {/* Por responsável (administrador) */}
          {isAdmin && (
            <Cartao
              titulo="Desempenho por responsável"
              descricao="Criadas e fechadas no período; abertas é a foto de agora. Ganhos em reais e em dólares separados."
            >
              {dados.porResponsavel.length === 0 ? (
                <Vazio />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-[#FAF7F2] text-sm font-semibold text-[#6B7280]">
                      <tr>
                        <th className="py-3 px-4">Responsável</th>
                        <th className="py-3 px-4 text-right">Criadas</th>
                        <th className="py-3 px-4 text-right">Abertas</th>
                        <th className="py-3 px-4 text-right">Ganhas</th>
                        <th className="py-3 px-4 text-right">Perdidas</th>
                        <th className="py-3 px-4 text-right">Vitória</th>
                        <th className="py-3 px-4 text-right">Ganho (R$)</th>
                        <th className="py-3 px-4 text-right">Ganho (US$)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB] text-base">
                      {dados.porResponsavel.map((p) => (
                        <tr key={p.id || 'sem'}>
                          <td className="py-3 px-4 font-semibold">{p.nome}</td>
                          <td className="py-3 px-4 text-right">{p.criadas}</td>
                          <td className="py-3 px-4 text-right">{p.abertas}</td>
                          <td className="py-3 px-4 text-right">{p.ganhas}</td>
                          <td className="py-3 px-4 text-right">{p.perdidas}</td>
                          <td className="py-3 px-4 text-right">
                            {p.taxaVitoria === null
                              ? '—'
                              : `${p.taxaVitoria.toLocaleString('pt-BR')}%`}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {p.ganhoBRL > 0 ? brl(p.ganhoBRL) : '—'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {p.ganhoUSD > 0 ? usd(p.ganhoUSD) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Cartao>
          )}

          {/* Taxas de passagem (Bloco 2) */}
          <PainelPipeline dados={pipeline} carregando={carregando && !pipeline} />
        </>
      )}
    </div>
  )
}
