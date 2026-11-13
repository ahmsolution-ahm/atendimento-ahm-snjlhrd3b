import { GitBranch, Trophy } from 'lucide-react'
import type { DadosPipeline } from '@/services/metricas'
import { META_TAXA_VITORIA, type TaxaEtapa } from '@/lib/pipeline'
import { plural } from '@/lib/metricas'

// Fase 2 · Bloco 2 (RN-2.3) — taxas de passagem real × alvo por etapa das duas trilhas e
// taxa de vitória. Fonte: histórico de etapas das oportunidades.

function TabelaTrilha({ titulo, linhas }: { titulo: string; linhas: TaxaEtapa[] }) {
  const comDados = linhas.some((l) => l.entraram > 0)
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-[#030507]">{titulo}</p>
      {!comDados ? (
        <p className="text-xs rounded-xl bg-amber-50 border border-amber-200 text-[#92400E] px-3 py-2">
          Nenhuma oportunidade passou por esta trilha no período.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[#6B7280]">
                <th className="py-1 pr-2 font-semibold">Etapa</th>
                <th className="py-1 px-2 font-semibold text-right">Entraram</th>
                <th className="py-1 px-2 font-semibold text-right">Avançaram</th>
                <th className="py-1 px-2 font-semibold text-right">Real</th>
                <th className="py-1 pl-2 font-semibold text-right">Alvo</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const abaixo = l.taxaReal !== null && l.taxaAlvo !== null && l.taxaReal < l.taxaAlvo
                return (
                  <tr key={l.etapaId} className="border-t border-[#F3F4F6]">
                    <td className="py-1.5 pr-2 text-[#374151]">
                      {l.ordem}. {l.nome}
                    </td>
                    <td className="py-1.5 px-2 text-right">{l.entraram}</td>
                    <td className="py-1.5 px-2 text-right">{l.avancaram}</td>
                    <td
                      className={`py-1.5 px-2 text-right font-semibold ${
                        l.taxaReal === null
                          ? 'text-[#9CA3AF]'
                          : abaixo
                            ? 'text-[#B91C1C]'
                            : 'text-[#059669]'
                      }`}
                    >
                      {l.taxaReal === null ? '—' : `${l.taxaReal.toLocaleString('pt-BR')}%`}
                    </td>
                    <td className="py-1.5 pl-2 text-right text-[#6B7280]">
                      {l.taxaAlvo === null ? '—' : `${l.taxaAlvo}%`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function PainelPipeline({
  dados,
  carregando,
}: {
  dados: DadosPipeline | null
  carregando: boolean
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#030507] flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-[#DE6464]" /> Pipeline — taxas de passagem
          </p>
          <p className="text-xs text-[#6B7280] max-w-2xl">
            De cada etapa, quantas oportunidades seguiram para uma etapa posterior, comparado com a
            taxa-alvo da metodologia. Voltar de etapa não conta como avanço; a última etapa não tem
            taxa de passagem. Considera todas as fontes, pelo período da entrada na etapa.
          </p>
        </div>
        <div className="rounded-xl border border-[#E5E7EB] px-4 py-2 text-right shrink-0">
          <p className="text-[11px] text-[#6B7280] flex items-center gap-1 justify-end">
            <Trophy className="w-3.5 h-3.5 text-[#DE6464]" /> Taxa de vitória
          </p>
          <p className="text-2xl font-extrabold text-[#030507]">
            {carregando
              ? '…'
              : dados?.taxaVitoria !== null && dados
                ? `${dados.taxaVitoria.toLocaleString('pt-BR')}%`
                : '—'}
          </p>
          <p className="text-[11px] text-[#6B7280]">
            {dados && dados.ganhas + dados.perdidas > 0
              ? `${plural(dados.ganhas, 'ganha', 'ganhas')} de ${plural(dados.ganhas + dados.perdidas, 'fechada', 'fechadas')} · meta ${META_TAXA_VITORIA}%`
              : `Sem fechamentos no período · meta ${META_TAXA_VITORIA}%`}
          </p>
        </div>
      </div>
      {dados && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TabelaTrilha titulo="AHM Cycle — produtos de baixa complexidade" linhas={dados.baixa} />
          <TabelaTrilha
            titulo="Site Assessment — produtos de alta complexidade"
            linhas={dados.alta}
          />
        </div>
      )}
    </div>
  )
}
