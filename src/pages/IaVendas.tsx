import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { BookOpen, CalendarClock, Inbox, Plus, Power, Route, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { usersService } from '@/services/users'
import { produtosService } from '@/services/produtos'
import {
  iaService,
  type ConhecimentoRecord,
  type EnvioIaRecord,
  type JanelaRecord,
  type ModoIa,
  type PreviaHorarios,
  type RegraRoteamentoRecord,
} from '@/services/ia'
import type { ProdutoRecord, UserRecord } from '@/types'

// IA de vendas · F0 — painel do administrador: modo de operação, fila de envios, roteamento,
// janelas de atendimento dos executivos e base de conhecimento. Nenhum e-mail sai nesta fase:
// a entrada inteligente (F1) e a conexão com o Microsoft 365 (F0.6) vêm depois.

const cartaoCls = 'bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5 lg:p-6'
const campoCls =
  'w-full px-3.5 py-2.5 rounded-xl border border-[#E5E7EB] text-base text-[#030507] bg-white outline-none focus:border-[#DE6464]'
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const TIPOS: { valor: ConhecimentoRecord['tipo']; rotulo: string }[] = [
  { valor: 'produto', rotulo: 'Produto' },
  { valor: 'metodologia', rotulo: 'Metodologia' },
  { valor: 'caso', rotulo: 'Caso de cliente' },
  { valor: 'pergunta_frequente', rotulo: 'Pergunta frequente' },
  { valor: 'material', rotulo: 'Material (vídeo, business case)' },
  { valor: 'especialista', rotulo: 'Especialista' },
]
const STATUS_ENVIO: Record<string, string> = {
  rascunho: 'Rascunho aguardando aprovação',
  aprovado: 'Aprovado',
  enviado: 'Enviado',
  falha: 'Falha no envio',
  descartado: 'Descartado',
  conflito: 'Conflito de vínculo',
}
const MODOS: { valor: ModoIa; titulo: string; texto: string }[] = [
  { valor: 'desligada', titulo: 'Desligada', texto: 'A IA não gera nem envia nada.' },
  {
    valor: 'rascunho',
    titulo: 'Rascunho (recomendado no início)',
    texto: 'A IA escreve o e-mail e avisa você; nada sai sem o seu clique de aprovação.',
  },
  {
    valor: 'automatica',
    titulo: 'Automática',
    texto:
      'A IA envia o primeiro e-mail sozinha, em seu nome, com todas as proteções e o registro de cada envio.',
  },
]

const msg = (err: unknown) => (err instanceof Error ? err.message : 'Ocorreu uma falha inesperada.')

function Secao({
  titulo,
  icone,
  descricao,
  children,
}: {
  titulo: string
  icone: ReactNode
  descricao: string
  children: ReactNode
}) {
  return (
    <div className={cartaoCls}>
      <p className="text-lg font-bold text-[#030507] flex items-center gap-2">
        {icone}
        {titulo}
      </p>
      <p className="text-sm text-[#6B7280] mt-1">{descricao}</p>
      <div className="mt-4">{children}</div>
    </div>
  )
}

const CONHECIMENTO_VAZIO = {
  tipo: 'produto' as ConhecimentoRecord['tipo'],
  titulo: '',
  conteudo: '',
  produto: '',
  familia: '',
  fonte: '',
  ativo: true,
}

export default function IaVendas() {
  const { toast } = useToast()
  const [modo, setModo] = useState<{ id: string; modo: ModoIa } | null>(null)
  const [envios, setEnvios] = useState<{ itens: EnvioIaRecord[]; total: number } | null>(null)
  const [usuarios, setUsuarios] = useState<UserRecord[]>([])
  const [modelos, setModelos] = useState<{ id: string; nome: string }[]>([])
  const [regras, setRegras] = useState<RegraRoteamentoRecord[]>([])
  const [executivo, setExecutivo] = useState('')
  const [janelas, setJanelas] = useState<JanelaRecord[]>([])
  const [novaJanela, setNovaJanela] = useState({ dia_semana: 1, inicio: '09:00', fim: '12:00' })
  const [previa, setPrevia] = useState<PreviaHorarios | null>(null)
  const [conhecimentos, setConhecimentos] = useState<ConhecimentoRecord[]>([])
  const [produtos, setProdutos] = useState<ProdutoRecord[]>([])
  const [form, setForm] = useState(CONHECIMENTO_VAZIO)
  const [editando, setEditando] = useState<string | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const [m, e, u, mo, r, c] = await Promise.all([
        iaService.lerModo(),
        iaService.envios(),
        usersService.list(),
        iaService.modelosNegocio(),
        iaService.regras(),
        iaService.conhecimentos(),
      ])
      setModo(m)
      setEnvios(e)
      setUsuarios(u)
      setModelos(mo)
      setRegras(r)
      setConhecimentos(c)
    } catch (err) {
      toast({
        title: 'Não foi possível carregar a IA de vendas',
        description: msg(err),
        variant: 'destructive',
      })
    }
    produtosService
      .list()
      .then((p) => setProdutos(p as ProdutoRecord[]))
      .catch(() => setProdutos([]))
  }, [toast])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    setPrevia(null)
    if (!executivo) {
      setJanelas([])
      return
    }
    iaService
      .janelas(executivo)
      .then(setJanelas)
      .catch(() => setJanelas([]))
  }, [executivo])

  const nomeUsuario = (id?: string) => {
    const u = usuarios.find((x) => x.id === id)
    return u ? u.name || u.email : ''
  }

  const trocarModo = async (novo: ModoIa) => {
    if (!modo || novo === modo.modo) return
    if (
      novo === 'automatica' &&
      !window.confirm(
        'No modo automático, os e-mails sairão em seu nome sem aprovação prévia. Confirma?',
      )
    )
      return
    try {
      await iaService.salvarModo(modo.id, novo)
      setModo({ ...modo, modo: novo })
      toast({ title: 'Modo de operação atualizado' })
    } catch (err) {
      toast({
        title: 'Não foi possível alterar o modo',
        description: msg(err),
        variant: 'destructive',
      })
    }
  }

  const salvarRegra = async (modeloId: string, dados: Partial<RegraRoteamentoRecord>) => {
    const atual = regras.find((r) => r.modelo_negocio === modeloId)
    try {
      const salvo = await iaService.salvarRegra({ ...dados, modelo_negocio: modeloId }, atual?.id)
      setRegras((lista) =>
        atual ? lista.map((r) => (r.id === atual.id ? salvo : r)) : [...lista, salvo],
      )
      toast({ title: 'Regra de roteamento atualizada' })
    } catch (err) {
      toast({
        title: 'Não foi possível salvar a regra',
        description: msg(err),
        variant: 'destructive',
      })
    }
  }

  const adicionarJanela = async () => {
    if (!executivo) return
    try {
      const j = await iaService.criarJanela({ vendedor: executivo, ...novaJanela, ativo: true })
      setJanelas((l) =>
        [...l, j].sort((a, b) => a.dia_semana - b.dia_semana || a.inicio.localeCompare(b.inicio)),
      )
      toast({ title: 'Janela adicionada' })
    } catch (err) {
      toast({
        title: 'Não foi possível adicionar a janela',
        description: msg(err),
        variant: 'destructive',
      })
    }
  }

  const removerJanela = async (id: string) => {
    try {
      await iaService.removerJanela(id)
      setJanelas((l) => l.filter((j) => j.id !== id))
    } catch (err) {
      toast({
        title: 'Não foi possível remover a janela',
        description: msg(err),
        variant: 'destructive',
      })
    }
  }

  const verPrevia = async () => {
    try {
      setPrevia(await iaService.previaHorarios(executivo))
    } catch (err) {
      toast({
        title: 'Não foi possível gerar a prévia',
        description: msg(err),
        variant: 'destructive',
      })
    }
  }

  const salvarConhecimento = async () => {
    if (!form.titulo.trim() || !form.conteudo.trim() || !form.fonte.trim()) {
      toast({
        title: 'Preencha título, conteúdo e fonte',
        description: 'Sem fonte, a IA não pode usar a informação.',
        variant: 'destructive',
      })
      return
    }
    try {
      await iaService.salvarConhecimento(form, editando || undefined)
      toast({ title: editando ? 'Conhecimento atualizado' : 'Conhecimento cadastrado' })
      setForm(CONHECIMENTO_VAZIO)
      setEditando(null)
      setMostrarForm(false)
      setConhecimentos(await iaService.conhecimentos())
    } catch (err) {
      toast({ title: 'Não foi possível salvar', description: msg(err), variant: 'destructive' })
    }
  }

  const removerConhecimento = async (c: ConhecimentoRecord) => {
    if (!window.confirm(`Remover “${c.titulo}” da base de conhecimento?`)) return
    try {
      await iaService.removerConhecimento(c.id)
      setConhecimentos((l) => l.filter((x) => x.id !== c.id))
    } catch (err) {
      toast({ title: 'Não foi possível remover', description: msg(err), variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-extrabold text-[#030507] flex items-center gap-3">
          <Sparkles className="w-7 h-7 text-[#DE6464]" /> IA de vendas
        </h1>
        <p className="text-base text-[#6B7280] mt-1">
          Fundação da inteligência que vai responder o primeiro contato, rotear para o executivo e
          oferecer a agenda. Nesta fase nenhum e-mail é enviado: a conexão com o Outlook e a entrada
          pelo RD Station e pelo Envya vêm a seguir.
        </p>
      </div>

      <Secao
        titulo="Modo de operação"
        icone={<Power className="w-5 h-5 text-[#DE6464]" />}
        descricao="Você muda quando quiser, sem programar nada."
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {MODOS.map((m) => {
            const ativo = modo?.modo === m.valor
            return (
              <button
                key={m.valor}
                type="button"
                onClick={() => trocarModo(m.valor)}
                disabled={!modo}
                className={`text-left rounded-2xl border-2 p-4 transition-colors ${
                  ativo
                    ? 'border-[#DE6464] bg-[#DE6464]/[0.06]'
                    : 'border-[#E5E7EB] hover:border-[#D1D5DB]'
                }`}
              >
                <p className="text-base font-bold text-[#030507]">
                  {m.titulo}
                  {ativo ? ' · ativo' : ''}
                </p>
                <p className="text-sm text-[#6B7280] mt-1">{m.texto}</p>
              </button>
            )
          })}
        </div>
      </Secao>

      <Secao
        titulo="Fila de envios da IA"
        icone={<Inbox className="w-5 h-5 text-[#DE6464]" />}
        descricao="Todo e-mail gerado pela IA fica registrado aqui, com o texto e a situação. O registro é gravado só pelo sistema."
      >
        {!envios || envios.itens.length === 0 ? (
          <p className="rounded-xl bg-[#FAF7F2] border border-dashed border-[#E5E7EB] px-5 py-8 text-center text-base text-[#6B7280]">
            Nenhum envio ainda. Os primeiros rascunhos aparecem aqui quando a entrada inteligente
            for ligada.
          </p>
        ) : (
          <ul className="divide-y divide-[#E5E7EB]">
            {envios.itens.map((e) => (
              <li
                key={e.id}
                className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-2"
              >
                <div>
                  <p className="text-base font-semibold text-[#030507]">
                    {e.assunto || 'Sem assunto'}
                  </p>
                  <p className="text-sm text-[#6B7280]">
                    {e.expand?.lead
                      ? `${e.expand.lead.nome} — ${e.expand.lead.empresa}`
                      : e.destinatario || '—'}
                  </p>
                </div>
                <span className="text-sm font-semibold px-3 py-1 rounded-full bg-[#FAF7F2] text-[#374151]">
                  {STATUS_ENVIO[e.status] || e.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao
        titulo="Roteamento por modelo de negócio"
        icone={<Route className="w-5 h-5 text-[#DE6464]" />}
        descricao="Para quem a IA encaminha cada lead. Lead de modelo sem regra ativa vai para a fila do administrador."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-base">
            <thead className="bg-[#FAF7F2] text-sm text-[#6B7280]">
              <tr>
                <th className="py-3 px-4">Modelo de negócio</th>
                <th className="py-3 px-4">Executivo</th>
                <th className="py-3 px-4">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {modelos.map((m) => {
                const r = regras.find((x) => x.modelo_negocio === m.id)
                return (
                  <tr key={m.id}>
                    <td className="py-3 px-4 font-semibold">{m.nome}</td>
                    <td className="py-3 px-4">
                      <select
                        value={r?.vendedor || ''}
                        onChange={(e) =>
                          salvarRegra(m.id, { vendedor: e.target.value, ativo: !!e.target.value })
                        }
                        className={campoCls}
                      >
                        <option value="">
                          {r?.vendedor_previsto
                            ? `${r.vendedor_previsto} (aguardando cadastro)`
                            : 'Sem executivo'}
                        </option>
                        {usuarios.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name || u.email}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      {r?.ativo ? (
                        <span className="text-[#059669] font-semibold">
                          Ativa — {nomeUsuario(r.vendedor)}
                        </span>
                      ) : r?.aguardando_cadastro ? (
                        <span className="text-[#92400E]">
                          Aguardando o cadastro de {r.vendedor_previsto}
                        </span>
                      ) : (
                        <span className="text-[#6B7280]">Sem regra: vai para o administrador</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Secao>

      <Secao
        titulo="Janelas de atendimento dos executivos"
        icone={<CalendarClock className="w-5 h-5 text-[#DE6464]" />}
        descricao="Horários preferidos de cada executivo. A IA só oferece ao cliente o que estiver dentro da janela E livre na agenda do Outlook."
      >
        <div className="space-y-4">
          <select
            value={executivo}
            onChange={(e) => setExecutivo(e.target.value)}
            className={`${campoCls} max-w-md`}
          >
            <option value="">Escolha o executivo</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
              </option>
            ))}
          </select>
          {executivo && (
            <>
              {janelas.length === 0 ? (
                <p className="text-base text-[#6B7280]">
                  Nenhuma janela cadastrada para este executivo.
                </p>
              ) : (
                <ul className="divide-y divide-[#E5E7EB]">
                  {janelas.map((j) => (
                    <li
                      key={j.id}
                      className="py-2 flex items-center justify-between gap-3 text-base"
                    >
                      <span>
                        {DIAS[j.dia_semana]}, das {j.inicio} às {j.fim}
                      </span>
                      <button
                        type="button"
                        onClick={() => removerJanela(j.id)}
                        aria-label="Remover janela"
                        className="p-2 rounded-lg text-[#6B7280] hover:text-[#B91C1C] hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-end gap-3">
                <select
                  value={novaJanela.dia_semana}
                  onChange={(e) =>
                    setNovaJanela({ ...novaJanela, dia_semana: Number(e.target.value) })
                  }
                  className={`${campoCls} w-44`}
                >
                  {DIAS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={novaJanela.inicio}
                  onChange={(e) => setNovaJanela({ ...novaJanela, inicio: e.target.value })}
                  className={`${campoCls} w-36`}
                />
                <input
                  type="time"
                  value={novaJanela.fim}
                  onChange={(e) => setNovaJanela({ ...novaJanela, fim: e.target.value })}
                  className={`${campoCls} w-36`}
                />
                <Button size="lg" onClick={adicionarJanela}>
                  <Plus className="w-4 h-4 mr-1.5" /> Adicionar janela
                </Button>
                <Button size="lg" variant="outline" onClick={verPrevia}>
                  Ver horários que seriam oferecidos
                </Button>
              </div>
              {previa && (
                <div className="rounded-xl bg-[#FAF7F2] px-4 py-3 text-base text-[#374151]">
                  {previa.horarios.length > 0 ? (
                    <ul className="list-disc pl-6">
                      {previa.horarios.map((h) => (
                        <li key={h.inicio}>
                          {new Date(h.inicio).toLocaleString('pt-BR', {
                            weekday: 'long',
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>{previa.mensagem}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </Secao>

      <Secao
        titulo="Base de conhecimento"
        icone={<BookOpen className="w-5 h-5 text-[#DE6464]" />}
        descricao="O que a IA pode usar para escrever: produtos, metodologia, casos, materiais e especialistas. Toda informação precisa de fonte — sem fonte, a IA não usa."
      >
        <div className="space-y-4">
          {!mostrarForm && (
            <Button
              size="lg"
              onClick={() => {
                setForm(CONHECIMENTO_VAZIO)
                setEditando(null)
                setMostrarForm(true)
              }}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Cadastrar conhecimento
            </Button>
          )}
          {mostrarForm && (
            <div className="rounded-2xl border border-[#E5E7EB] bg-[#FAF7F2] p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-[#374151] mb-1.5">Tipo</label>
                  <select
                    value={form.tipo}
                    onChange={(e) =>
                      setForm({ ...form, tipo: e.target.value as ConhecimentoRecord['tipo'] })
                    }
                    className={campoCls}
                  >
                    {TIPOS.map((t) => (
                      <option key={t.valor} value={t.valor}>
                        {t.rotulo}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                    Produto (opcional)
                  </label>
                  <select
                    value={form.produto}
                    onChange={(e) => setForm({ ...form, produto: e.target.value })}
                    className={campoCls}
                  >
                    <option value="">Nenhum</option>
                    {produtos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#374151] mb-1.5">Título</label>
                <input
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  className={campoCls}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                  Conteúdo
                </label>
                <textarea
                  rows={5}
                  value={form.conteudo}
                  onChange={(e) => setForm({ ...form, conteudo: e.target.value })}
                  className={campoCls}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                    Família (opcional)
                  </label>
                  <input
                    value={form.familia}
                    onChange={(e) => setForm({ ...form, familia: e.target.value })}
                    className={campoCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                    Fonte (obrigatória)
                  </label>
                  <input
                    value={form.fonte}
                    onChange={(e) => setForm({ ...form, fonte: e.target.value })}
                    placeholder="Ex.: catálogo do fabricante, link do vídeo, nome do documento"
                    className={campoCls}
                  />
                </div>
              </div>
              <label className="flex items-center gap-3 text-base">
                <input
                  type="checkbox"
                  className="w-5 h-5 accent-[#DE6464]"
                  checked={form.ativo}
                  onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                />
                Disponível para a IA
              </label>
              <div className="flex gap-3 justify-end">
                <Button variant="ghost" size="lg" onClick={() => setMostrarForm(false)}>
                  Cancelar
                </Button>
                <Button size="lg" onClick={salvarConhecimento}>
                  Salvar
                </Button>
              </div>
            </div>
          )}
          {conhecimentos.length === 0 ? (
            <p className="rounded-xl bg-[#FAF7F2] border border-dashed border-[#E5E7EB] px-5 py-8 text-center text-base text-[#6B7280]">
              A base ainda está vazia. Comece pelos especialistas de cada produto e pelos vídeos e
              business cases.
            </p>
          ) : (
            <ul className="divide-y divide-[#E5E7EB]">
              {conhecimentos.map((c) => (
                <li
                  key={c.id}
                  className="py-3 flex flex-col md:flex-row md:items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-[#030507]">
                      {c.titulo}
                      {!c.ativo && (
                        <span className="ml-2 text-sm font-normal text-[#6B7280]">
                          (indisponível para a IA)
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-[#6B7280]">
                      {TIPOS.find((t) => t.valor === c.tipo)?.rotulo}
                      {c.expand?.produto ? ` · ${c.expand.produto.nome}` : ''} · Fonte: {c.fonte}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setForm({
                          tipo: c.tipo,
                          titulo: c.titulo,
                          conteudo: c.conteudo,
                          produto: c.produto || '',
                          familia: c.familia || '',
                          fonte: c.fonte,
                          ativo: !!c.ativo,
                        })
                        setEditando(c.id)
                        setMostrarForm(true)
                      }}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      className="text-[#B91C1C]"
                      onClick={() => removerConhecimento(c)}
                    >
                      Remover
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Secao>
    </div>
  )
}
