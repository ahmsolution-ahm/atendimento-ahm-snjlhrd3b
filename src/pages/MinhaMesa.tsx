import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeftRight,
  ArrowRight,
  Compass,
  Handshake,
  Target,
  Trophy,
  UserPlus,
  Wallet,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { mesaService, type ListaCurta } from '@/services/mesa'
import { desempenhoService, type DadosDesempenho } from '@/services/desempenho'
import { oportunidadesService } from '@/services/oportunidades'
import {
  etapaVizinha,
  etapasDaTrilha,
  formatarValor,
  proximoPasso,
  trilhaDoProduto,
} from '@/lib/pipeline'
import { plural } from '@/lib/metricas'
import type { LeadRecord, OportunidadeRecord, PipelineEtapaRecord, TransbordoRecord } from '@/types'

// Fase 2 · Bloco C — "Minha mesa": tela inicial do CRM (substitui o antigo portal de tickets).
// Vendedor: os próprios leads, oportunidades (com o próximo passo de cada uma), transbordos e
// o resumo do mês. Administrador: a mesma mesa com a visão do time.
// Tudo vem do banco; sem dados, a tela diz isso (nenhum número ou frase fixa).

const cartaoCls = 'bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5 lg:p-6'

const textoMoedas = (BRL: number, USD: number) => {
  const partes: string[] = []
  if (BRL > 0) partes.push(formatarValor(BRL, 'BRL'))
  if (USD > 0) partes.push(formatarValor(USD, 'USD'))
  return partes.length > 0 ? partes.join(' · ') : 'Sem valor definido'
}

const rotuloStatusLead = (s?: string) =>
  s === 'novo'
    ? 'Novo'
    : s === 'em qualificação'
      ? 'Em qualificação'
      : s === 'pendente'
        ? 'Pendente'
        : s || '—'

function Resumo({
  rotulo,
  valor,
  detalhe,
  icone,
}: {
  rotulo: string
  valor: string
  detalhe: string
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
      <p className="text-3xl font-extrabold text-[#030507]">{valor}</p>
      <p className="text-sm text-[#6B7280]">{detalhe}</p>
    </div>
  )
}

function Secao({
  titulo,
  icone,
  total,
  link,
  linkTexto,
  children,
}: {
  titulo: string
  icone: ReactNode
  total?: number
  link: string
  linkTexto: string
  children: ReactNode
}) {
  return (
    <div className={cartaoCls}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-lg font-bold text-[#030507] flex items-center gap-2">
          {icone}
          {titulo}
          {typeof total === 'number' && (
            <span className="ml-1 px-2.5 py-0.5 rounded-full bg-[#FAF7F2] text-sm font-semibold text-[#374151]">
              {total.toLocaleString('pt-BR')}
            </span>
          )}
        </p>
        <Link
          to={link}
          className="text-base font-semibold text-[#DE6464] hover:underline flex items-center gap-1"
        >
          {linkTexto} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      {children}
    </div>
  )
}

const Vazio = ({ texto }: { texto: string }) => (
  <p className="rounded-xl bg-[#FAF7F2] border border-dashed border-[#E5E7EB] px-5 py-8 text-center text-base text-[#6B7280]">
    {texto}
  </p>
)

export default function MinhaMesa() {
  const { user, isAdmin } = useAuth()
  const alvo = isAdmin ? '' : user?.id || ''

  const [ops, setOps] = useState<ListaCurta<OportunidadeRecord> | null>(null)
  const [leads, setLeads] = useState<ListaCurta<LeadRecord> | null>(null)
  const [transbordos, setTransbordos] = useState<ListaCurta<TransbordoRecord> | null>(null)
  const [mes, setMes] = useState<DadosDesempenho | null>(null)
  const [etapas, setEtapas] = useState<PipelineEtapaRecord[]>([])
  const [erro, setErro] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    let ativo = true
    Promise.all([
      mesaService.oportunidadesAbertas(alvo),
      mesaService.leadsParaTrabalhar(alvo),
      mesaService.transbordosAbertos(alvo),
      // o resumo do mês não pode derrubar a mesa inteira
      desempenhoService.carregar('mes', 'todas', isAdmin ? 'todos' : user.id).catch(() => null),
      oportunidadesService.etapas().catch(() => [] as PipelineEtapaRecord[]),
    ])
      .then(([o, l, t, d, e]) => {
        if (!ativo) return
        setOps(o)
        setLeads(l)
        setTransbordos(t)
        setMes(d)
        setEtapas(e)
      })
      .catch(() => ativo && setErro(true))
    return () => {
      ativo = false
    }
  }, [alvo, isAdmin, user?.id])

  const hoje = useMemo(
    () =>
      new Date().toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    [],
  )
  const primeiroNome = (user?.name || '').split(' ')[0]

  const passoDe = (op: OportunidadeRecord) => {
    const trilha = op.trilha || trilhaDoProduto(op.expand?.produto?.complexidade)
    const atual = etapasDaTrilha(etapas, trilha).find((e) => e.id === op.etapa_atual)
    const proxima = etapaVizinha(etapas, trilha, op.etapa_atual, 1)
    return proximoPasso({
      trilha,
      etapaAtualNome: atual?.nome,
      proximaEtapaNome: proxima?.nome,
      resultado: op.resultado,
      ambiente: op.ambiente_fechamento,
      valor: op.valor_estimado,
    })
  }

  return (
    <div className="space-y-6">
      {/* Saudação */}
      <div
        className={`${cartaoCls} flex flex-col lg:flex-row lg:items-center justify-between gap-4`}
      >
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-[#030507] tracking-tight">
            {primeiroNome ? `Olá, ${primeiroNome}!` : 'Olá!'}
          </h1>
          <p className="text-base text-[#6B7280] mt-1 first-letter:uppercase">
            {hoje} · {isAdmin ? 'Visão do time' : 'Seus leads, oportunidades e resultados do mês'}
          </p>
        </div>
        <Link
          to="/leads?novo=1"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-base font-semibold text-white shadow-md hover:bg-[#C94F4F]"
          style={{ backgroundColor: '#DE6464' }}
        >
          <UserPlus className="w-5 h-5" /> Novo lead
        </Link>
      </div>

      {erro && (
        <p className="rounded-xl bg-red-50 border border-red-200 text-[#991B1B] px-4 py-3 text-base">
          Não foi possível carregar a sua mesa. Atualize a página para tentar de novo.
        </p>
      )}

      {/* Resumo do mês */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Resumo
          rotulo="Negócios criados no mês"
          valor={mes ? String(mes.totalCriadas) : '…'}
          detalhe={
            mes
              ? isAdmin
                ? `Meta do time: ${mes.meta} por mês`
                : 'Oportunidades sob a sua responsabilidade'
              : ''
          }
          icone={<Target className="w-5 h-5" />}
        />
        <Resumo
          rotulo="Em negociação agora"
          valor={mes ? String(mes.negociacao.qtd) : '…'}
          detalhe={mes ? textoMoedas(mes.negociacao.BRL, mes.negociacao.USD) : ''}
          icone={<Handshake className="w-5 h-5" />}
        />
        <Resumo
          rotulo="Ganhos no mês"
          valor={mes ? String(mes.ganhas.qtd) : '…'}
          detalhe={mes ? textoMoedas(mes.ganhas.BRL, mes.ganhas.USD) : ''}
          icone={<Trophy className="w-5 h-5" />}
        />
        <Resumo
          rotulo="Abertas no pipeline"
          valor={mes ? String(mes.abertas.qtd) : '…'}
          detalhe={mes ? textoMoedas(mes.abertas.BRL, mes.abertas.USD) : ''}
          icone={<Wallet className="w-5 h-5" />}
        />
      </div>

      {/* Oportunidades com próximo passo */}
      <Secao
        titulo={isAdmin ? 'Oportunidades abertas do time' : 'Minhas oportunidades'}
        icone={<Compass className="w-5 h-5 text-[#DE6464]" />}
        total={ops?.total}
        link="/oportunidades"
        linkTexto="Ver todas"
      >
        {!ops ? (
          <Vazio texto="Carregando…" />
        ) : ops.itens.length === 0 ? (
          <Vazio
            texto={
              isAdmin
                ? 'Nenhuma oportunidade aberta no momento.'
                : 'Você não tem oportunidades abertas. Quando um lead seu for qualificado, a oportunidade aparece aqui.'
            }
          />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {ops.itens.map((op) => {
              const passo = passoDe(op)
              const lead = op.expand?.lead
              return (
                <Link
                  key={op.id}
                  to={`/oportunidades/${op.id}`}
                  className="block rounded-xl border border-[#E5E7EB] hover:border-[#DE6464] hover:shadow-sm transition-all p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-bold text-[#030507] truncate">
                        {lead ? `${lead.nome} — ${lead.empresa}` : 'Lead removido'}
                      </p>
                      <p className="text-sm text-[#6B7280]">
                        {op.expand?.etapa_atual?.nome || 'Pipeline não iniciado'}
                        {op.expand?.produto?.nome ? ` · ${op.expand.produto.nome}` : ''}
                        {isAdmin
                          ? ` · ${op.expand?.responsavel?.name || op.expand?.responsavel?.email || 'Sem responsável'}`
                          : ''}
                      </p>
                    </div>
                    <span className="text-base font-semibold text-[#030507] shrink-0">
                      {formatarValor(op.valor_estimado, op.moeda)}
                    </span>
                  </div>
                  <p
                    className={`mt-3 rounded-lg px-3 py-2 text-sm ${
                      passo.codigo === 'preencher_fechamento' || passo.codigo === 'sem_trilha'
                        ? 'bg-amber-50 text-[#92400E]'
                        : 'bg-[#DE6464]/[0.07] text-[#030507]'
                    }`}
                  >
                    <span className="font-semibold">Próximo passo: </span>
                    {passo.texto}
                  </p>
                </Link>
              )
            })}
          </div>
        )}
      </Secao>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Leads */}
        <Secao
          titulo={isAdmin ? 'Leads para trabalhar (time)' : 'Meus leads para trabalhar'}
          icone={<UserPlus className="w-5 h-5 text-[#DE6464]" />}
          total={leads?.total}
          link="/leads"
          linkTexto="Ir para Leads"
        >
          {!leads ? (
            <Vazio texto="Carregando…" />
          ) : leads.itens.length === 0 ? (
            <Vazio texto="Nenhum lead novo ou pendente sob a sua responsabilidade." />
          ) : (
            <ul className="divide-y divide-[#E5E7EB]">
              {leads.itens.map((l) => (
                <li key={l.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-[#030507] truncate">{l.nome}</p>
                    <p className="text-sm text-[#6B7280] truncate">{l.empresa}</p>
                  </div>
                  <span className="text-sm font-semibold px-2.5 py-1 rounded-full bg-[#FAF7F2] text-[#374151] shrink-0">
                    {rotuloStatusLead(l.status)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Secao>

        {/* Transbordos */}
        <Secao
          titulo={isAdmin ? 'Transbordos abertos (time)' : 'Meus transbordos abertos'}
          icone={<ArrowLeftRight className="w-5 h-5 text-[#DE6464]" />}
          total={transbordos?.total}
          link="/transbordos"
          linkTexto="Ir para Transbordos"
        >
          {!transbordos ? (
            <Vazio texto="Carregando…" />
          ) : transbordos.itens.length === 0 ? (
            <Vazio texto="Nenhum transbordo aberto." />
          ) : (
            <ul className="divide-y divide-[#E5E7EB]">
              {transbordos.itens.map((t) => (
                <li key={t.id} className="py-3">
                  <p className="text-base font-semibold text-[#030507]">
                    {t.expand?.lead
                      ? `${t.expand.lead.nome} — ${t.expand.lead.empresa}`
                      : 'Lead removido'}
                  </p>
                  <p className="text-sm text-[#6B7280]">
                    {t.status} ·{' '}
                    {t.expand?.especialista?.name ||
                      t.expand?.especialista?.email ||
                      'Sem especialista atribuído'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Secao>
      </div>

      {mes && (
        <p className="text-sm text-[#6B7280]">
          {plural(mes.abertas.qtd, 'oportunidade aberta', 'oportunidades abertas')} no total · os
          indicadores completos estão em{' '}
          <Link to="/desempenho" className="font-semibold text-[#DE6464] hover:underline">
            Desempenho
          </Link>
          .
        </p>
      )}
    </div>
  )
}
