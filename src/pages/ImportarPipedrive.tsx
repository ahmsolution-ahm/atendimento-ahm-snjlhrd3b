import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import {
  lerPlanilha,
  lerZip,
  mapearNegocios,
  resumir,
  type ItemImportacao,
  type ResultadoMapeamento,
  type ResumoImportacao,
} from '@/lib/pipedrive'

// Fase 2 · Bloco D — importação do histórico do Pipedrive (só administrador).
// 1) lê a planilha no navegador e aplica as regras aprovadas pelo owner;
// 2) PRÉVIA no servidor (nada é gravado): novos, já importados, ligados a lead existente;
// 3) o administrador confirma → grava em lotes de 500 → confere a contagem com a prévia.

interface RetornoServidor {
  simulacao: boolean
  recebidos: number
  oportunidadesNovas: number
  leadsNovos: number
  ligadasALeadExistente: number
  leadsJaNaBase: number
  jaImportados: number
  falhas: { pipedrive_id: string; motivo: string }[]
  totalFalhas: number
  amostraLigacoes: { pipedrive: string; lead: string }[]
  responsaveis: Record<string, string | null>
}

const LOTE = 500
const NOMES_ETAPA: Record<string, string> = {
  '3': '3. Refinamento',
  '4': '4. Apresentação de Projeto',
  '5': '5. Negociação (prova de conceito)',
  '6': '6. Implementação',
  '7': '7. Realidade',
  '8': '8. Adoção Corporativa',
}

const cartaoCls = 'bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5 lg:p-6'
const n = (v: number) => v.toLocaleString('pt-BR')

// oportunidades primeiro: o lead nasce do negócio comercial (não arquivado) e o negócio de
// pré-venda da mesma empresa passa a contar como "já na base"
const ordenar = (itens: ItemImportacao[]) =>
  [...itens].sort((a, b) =>
    a.tipo === b.tipo ? a.chave.localeCompare(b.chave) : a.tipo === 'oportunidade' ? -1 : 1,
  )

const somar = (a: RetornoServidor | null, b: RetornoServidor): RetornoServidor =>
  !a
    ? b
    : {
        ...a,
        recebidos: a.recebidos + b.recebidos,
        oportunidadesNovas: a.oportunidadesNovas + b.oportunidadesNovas,
        leadsNovos: a.leadsNovos + b.leadsNovos,
        ligadasALeadExistente: a.ligadasALeadExistente + b.ligadasALeadExistente,
        leadsJaNaBase: a.leadsJaNaBase + b.leadsJaNaBase,
        jaImportados: a.jaImportados + b.jaImportados,
        falhas: [...a.falhas, ...b.falhas].slice(0, 200),
        totalFalhas: a.totalFalhas + b.totalFalhas,
        amostraLigacoes: a.amostraLigacoes,
        responsaveis: { ...a.responsaveis, ...b.responsaveis },
      }

function Numero({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string
  valor: number
  destaque?: boolean
}) {
  return (
    <div
      className={`rounded-xl px-4 py-3 ${destaque ? 'bg-[#DE6464]/[0.08] border border-[#DE6464]/30' : 'bg-[#FAF7F2]'}`}
    >
      <p className="text-sm text-[#6B7280]">{rotulo}</p>
      <p className="text-2xl font-extrabold text-[#030507]">{n(valor)}</p>
    </div>
  )
}

export default function ImportarPipedrive() {
  const { toast } = useToast()
  const [arquivo, setArquivo] = useState('')
  const [lendo, setLendo] = useState(false)
  const [mapa, setMapa] = useState<ResultadoMapeamento | null>(null)
  const [resumo, setResumo] = useState<ResumoImportacao | null>(null)
  const [previa, setPrevia] = useState<RetornoServidor | null>(null)
  const [simulando, setSimulando] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [final, setFinal] = useState<RetornoServidor | null>(null)
  const [confirmar, setConfirmar] = useState(false)

  const erro = (titulo: string, err: unknown) =>
    toast({
      title: titulo,
      description: err instanceof Error ? err.message : 'Ocorreu uma falha inesperada.',
      variant: 'destructive',
    })

  const escolher = async (f: File | undefined) => {
    if (!f) return
    setArquivo(f.name)
    setMapa(null)
    setResumo(null)
    setPrevia(null)
    setFinal(null)
    setLendo(true)
    try {
      const { linhas } = lerPlanilha(await lerZip(await f.arrayBuffer()))
      if (linhas.length === 0 || !('Funil' in linhas[0]) || !('Etapa' in linhas[0])) {
        throw new Error(
          'A planilha não parece ser a exportação de negócios do Pipedrive (faltam as colunas Funil e Etapa).',
        )
      }
      const m = mapearNegocios(linhas)
      setMapa(m)
      setResumo(resumir(m, linhas.length))
    } catch (err) {
      erro('Não foi possível ler a planilha', err)
    } finally {
      setLendo(false)
    }
  }

  const simular = async () => {
    if (!mapa) return
    setSimulando(true)
    setPrevia(null)
    try {
      const r = await pb.send<RetornoServidor>('/backend/v1/pipedrive/importar', {
        method: 'POST',
        body: { itens: ordenar(mapa.itens), simular: true },
        requestKey: null,
      })
      setPrevia(r)
    } catch (err) {
      erro('Não foi possível gerar a prévia', err)
    } finally {
      setSimulando(false)
    }
  }

  const importar = async () => {
    if (!mapa) return
    setConfirmar(false)
    setGravando(true)
    setProgresso(0)
    let acumulado: RetornoServidor | null = null
    const itens = ordenar(mapa.itens)
    try {
      for (let i = 0; i < itens.length; i += LOTE) {
        const r = await pb.send<RetornoServidor>('/backend/v1/pipedrive/importar', {
          method: 'POST',
          body: { itens: itens.slice(i, i + LOTE), simular: false },
          requestKey: null,
        })
        acumulado = somar(acumulado, r)
        setProgresso(Math.min(itens.length, i + LOTE))
      }
      setFinal(acumulado)
      toast({ title: 'Importação concluída' })
    } catch (err) {
      setFinal(acumulado)
      erro('A importação parou no meio — pode repetir com segurança (nada é duplicado)', err)
    } finally {
      setGravando(false)
    }
  }

  const confere =
    !!final &&
    !!previa &&
    final.oportunidadesNovas === previa.oportunidadesNovas &&
    final.leadsNovos === previa.leadsNovos

  return (
    <div className="space-y-6 max-w-6xl">
      <Link
        to="/desempenho"
        className="inline-flex items-center gap-2 text-base font-semibold text-[#6B7280] hover:text-[#DE6464]"
      >
        <ArrowLeft className="w-4 h-4" /> Desempenho
      </Link>
      <div>
        <h1 className="text-2xl lg:text-3xl font-extrabold text-[#030507] flex items-center gap-3">
          <FileSpreadsheet className="w-7 h-7 text-[#DE6464]" /> Importar histórico do Pipedrive
        </h1>
        <p className="text-base text-[#6B7280] mt-1">
          Envie a exportação de negócios do Pipedrive (.xlsx). Nada é gravado antes da sua
          confirmação, e repetir a importação não duplica registros.
        </p>
      </div>

      {/* 1. Arquivo */}
      <div className={cartaoCls}>
        <p className="text-lg font-bold text-[#030507]">1. Planilha</p>
        <label className="mt-3 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#E5E7EB] hover:border-[#DE6464] bg-[#FAF7F2] px-6 py-10 cursor-pointer text-center">
          <Upload className="w-8 h-8 text-[#DE6464]" />
          <span className="text-base font-semibold text-[#030507]">
            {arquivo || 'Escolher a planilha exportada do Pipedrive'}
          </span>
          <span className="text-sm text-[#6B7280]">
            Arquivo .xlsx com todos os negócios (abertos, ganhos e perdidos)
          </span>
          <input
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => escolher(e.target.files?.[0])}
            disabled={lendo || gravando}
          />
        </label>
        {lendo && (
          <p className="mt-3 text-base text-[#6B7280] flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Lendo a planilha…
          </p>
        )}
      </div>

      {/* 2. O que a planilha tem */}
      {resumo && (
        <div className={`${cartaoCls} space-y-5`}>
          <p className="text-lg font-bold text-[#030507]">
            2. O que será importado (regras aprovadas)
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Numero rotulo="Negócios na planilha" valor={resumo.total} />
            <Numero rotulo="Viram oportunidades" valor={resumo.oportunidades} destaque />
            <Numero rotulo="Viram leads (pré-vendas)" valor={resumo.leads} destaque />
            <Numero rotulo="Ficam fora" valor={resumo.descartados} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div>
              <p className="text-base font-semibold text-[#030507] mb-2">
                Oportunidades por etapa (trilha alta)
              </p>
              <ul className="space-y-1 text-base">
                {Object.entries(resumo.porEtapa)
                  .sort((a, b) => Number(a[0]) - Number(b[0]))
                  .map(([k, v]) => (
                    <li key={k} className="flex justify-between gap-3">
                      <span className="text-[#374151]">{NOMES_ETAPA[k] || k}</span>
                      <span className="font-semibold">{n(v)}</span>
                    </li>
                  ))}
              </ul>
            </div>
            <div>
              <p className="text-base font-semibold text-[#030507] mb-2">Situação no Pipedrive</p>
              <ul className="space-y-1 text-base">
                {Object.entries(resumo.porStatus).map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-3">
                    <span className="text-[#374151]">{k}</span>
                    <span className="font-semibold">{n(v)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-base font-semibold text-[#030507] mb-2">Ficam fora</p>
              <ul className="space-y-1 text-base">
                {Object.entries(resumo.descartesPorMotivo).map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-3">
                    <span className="text-[#374151]">{k}</span>
                    <span className="font-semibold">{n(v)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="rounded-xl bg-[#FAF7F2] px-4 py-3 text-base text-[#374151] space-y-1">
            <p>
              Perdas: <strong>{n(resumo.motivos.classificados)}</strong> com motivo da lista ·{' '}
              <strong>{n(resumo.motivos.semClassificacao)}</strong> sem classificação (texto
              original guardado na observação) · {n(resumo.motivos.vazios)} sem motivo.
            </p>
            <p>
              Moedas fora de R$ e US$: <strong>{n(resumo.outrasMoedas)}</strong> negócios — entram
              sem valor no CRM, com o valor e a moeda originais guardados (sem conversão).
            </p>
          </div>
          <Button size="lg" onClick={simular} disabled={simulando || gravando}>
            {simulando ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Comparando com a base…
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 mr-1.5" /> Gerar prévia (nada é gravado)
              </>
            )}
          </Button>
        </div>
      )}

      {/* 3. Prévia do servidor */}
      {previa && (
        <div className={`${cartaoCls} space-y-5`}>
          <p className="text-lg font-bold text-[#030507]">3. Prévia contra a base do CRM</p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Numero rotulo="Oportunidades a criar" valor={previa.oportunidadesNovas} destaque />
            <Numero rotulo="Leads a criar" valor={previa.leadsNovos} destaque />
            <Numero
              rotulo="Oportunidades ligadas a lead que já existe"
              valor={previa.ligadasALeadExistente}
            />
            <Numero
              rotulo="Negócios de pré-venda cujo lead já existe"
              valor={previa.leadsJaNaBase}
            />
            <Numero rotulo="Já importados antes" valor={previa.jaImportados} />
            <Numero rotulo="Com problema" valor={previa.totalFalhas} />
          </div>

          <div>
            <p className="text-base font-semibold text-[#030507] mb-2">
              Responsáveis (proprietário no Pipedrive → usuário no CRM)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-1 text-base">
              {Object.entries(previa.responsaveis)
                .sort((a, b) => (a[1] ? 0 : 1) - (b[1] ? 0 : 1) || a[0].localeCompare(b[0]))
                .map(([prop, usuario]) => (
                  <p
                    key={prop}
                    className="flex justify-between gap-3 border-b border-[#F3F4F6] py-1"
                  >
                    <span className="text-[#374151]">{prop}</span>
                    <span className={usuario ? 'font-semibold text-[#059669]' : 'text-[#6B7280]'}>
                      {usuario || 'Sem responsável'}
                    </span>
                  </p>
                ))}
            </div>
          </div>

          {previa.amostraLigacoes.length > 0 && (
            <div>
              <p className="text-base font-semibold text-[#030507] mb-2">
                Amostra das ligações a leads existentes (confira se a empresa e a pessoa batem)
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-base">
                  <thead className="bg-[#FAF7F2] text-sm text-[#6B7280]">
                    <tr>
                      <th className="py-2 px-3">No Pipedrive (empresa / pessoa)</th>
                      <th className="py-2 px-3">Lead encontrado no CRM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {previa.amostraLigacoes.map((a, i) => (
                      <tr key={i}>
                        <td className="py-2 px-3">{a.pipedrive}</td>
                        <td className="py-2 px-3">{a.lead}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {previa.falhas.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-base text-[#92400E]">
              <p className="font-semibold mb-1">Negócios com problema (não serão gravados):</p>
              <ul className="list-disc pl-6">
                {previa.falhas.slice(0, 10).map((f, i) => (
                  <li key={i}>
                    Nº {f.pipedrive_id || '—'}: {f.motivo}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!confirmar ? (
            <Button
              size="lg"
              onClick={() => setConfirmar(true)}
              disabled={gravando || previa.oportunidadesNovas + previa.leadsNovos === 0}
            >
              <Upload className="w-4 h-4 mr-1.5" /> Importar
            </Button>
          ) : (
            <div className="rounded-xl border-2 border-[#DE6464]/40 bg-[#DE6464]/[0.05] p-4 space-y-3">
              <p className="text-base text-[#030507]">
                Confirma a gravação de <strong>{n(previa.oportunidadesNovas)}</strong> oportunidades
                e <strong>{n(previa.leadsNovos)}</strong> leads? Os registros ficam identificados
                com o número do Pipedrive.
              </p>
              <div className="flex gap-3">
                <Button variant="ghost" size="lg" onClick={() => setConfirmar(false)}>
                  Cancelar
                </Button>
                <Button size="lg" onClick={importar}>
                  Confirmar importação
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Gravação e conferência */}
      {(gravando || final) && mapa && (
        <div className={`${cartaoCls} space-y-4`}>
          <p className="text-lg font-bold text-[#030507]">4. Gravação e conferência</p>
          {gravando && (
            <div className="space-y-2">
              <p className="text-base text-[#374151] flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Gravando {n(progresso)} de{' '}
                {n(mapa.itens.length)}…
              </p>
              <div className="h-3 rounded-full bg-[#F3F4F6] overflow-hidden">
                <div
                  className="h-full bg-[#DE6464]"
                  style={{ width: `${(progresso / Math.max(1, mapa.itens.length)) * 100}%` }}
                />
              </div>
            </div>
          )}
          {final && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Numero rotulo="Oportunidades criadas" valor={final.oportunidadesNovas} destaque />
                <Numero rotulo="Leads criados" valor={final.leadsNovos} destaque />
                <Numero rotulo="Já importados (ignorados)" valor={final.jaImportados} />
                <Numero rotulo="Com problema" valor={final.totalFalhas} />
              </div>
              {confere ? (
                <p className="rounded-xl bg-emerald-50 border border-emerald-200 text-[#065F46] px-4 py-3 text-base flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> A contagem gravada confere com a prévia.
                </p>
              ) : (
                <p className="rounded-xl bg-amber-50 border border-amber-200 text-[#92400E] px-4 py-3 text-base">
                  A contagem gravada difere da prévia. Gere a prévia de novo: o que já entrou
                  aparece como “já importado” e o restante pode ser importado com segurança.
                </p>
              )}
              {final.falhas.length > 0 && (
                <ul className="list-disc pl-6 text-base text-[#92400E]">
                  {final.falhas.slice(0, 20).map((f, i) => (
                    <li key={i}>
                      Nº {f.pipedrive_id || '—'}: {f.motivo}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
