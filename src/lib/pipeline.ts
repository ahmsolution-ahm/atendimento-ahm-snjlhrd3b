// F2-T02/T03 — emendas 1.2a e 1.2b: regras puras do pipeline (espelham o hook do servidor,
// que é a fonte da verdade; aqui servem para a tela mostrar o resultado antes de salvar).

export type TrilhaPipeline = 'baixa' | 'alta'

export interface EtapaPipeline {
  id: string
  trilha: TrilhaPipeline
  ordem: number
  nome: string
  fase: string
  taxa_alvo?: number
}

// ambiente de fechamento → moeda e entidade vendedora (derivados, não editáveis)
export function derivarFechamento(ambiente?: string): {
  moeda: 'BRL' | 'USD' | ''
  entidade: 'AHM Brasil' | 'AHM Solution Americas' | ''
} {
  if (ambiente === 'Exportação (EUA)') return { moeda: 'USD', entidade: 'AHM Solution Americas' }
  if (ambiente === 'Venda em reais' || ambiente === 'Locação em reais')
    return { moeda: 'BRL', entidade: 'AHM Brasil' }
  return { moeda: '', entidade: '' }
}

// RN-2.1: a trilha vem da complexidade do produto
export function trilhaDoProduto(complexidade?: string): TrilhaPipeline | '' {
  if (complexidade === 'Alta') return 'alta'
  if (complexidade === 'Baixa') return 'baixa'
  return ''
}

export function rotuloTrilha(trilha?: string): string {
  if (trilha === 'baixa') return 'AHM Cycle — 5 fases (produto de baixa complexidade)'
  if (trilha === 'alta') return 'Site Assessment — 8 etapas (produto de alta complexidade)'
  return ''
}

export function etapasDaTrilha<T extends EtapaPipeline>(etapas: T[], trilha?: string): T[] {
  return etapas.filter((e) => e.trilha === trilha).sort((a, b) => a.ordem - b.ordem)
}

export function etapaVizinha<T extends EtapaPipeline>(
  etapas: T[],
  trilha: string | undefined,
  etapaAtualId: string | undefined,
  direcao: 1 | -1,
): T | null {
  const lista = etapasDaTrilha(etapas, trilha)
  const idx = lista.findIndex((e) => e.id === etapaAtualId)
  if (idx < 0) return null
  return lista[idx + direcao] || null
}

// decisão do owner: para mudar de etapa é preciso ambiente de fechamento e valor estimado > 0
export function camposFaltantesParaMover(ambiente?: string, valor?: number | null): string[] {
  const faltando: string[] = []
  if (!ambiente) faltando.push('ambiente de fechamento')
  if (!(typeof valor === 'number' && valor > 0)) faltando.push('valor estimado')
  return faltando
}

// ---------------------------------------------------------------------------------------
// Fase 2 · Bloco 2 — fluxo guiado, checklist, fechamento e taxas de passagem.

/**
 * Próximo passo da oportunidade, em linguagem simples (e com um código estável para que um
 * agente de IA possa ler o mesmo estado que o vendedor vê na tela).
 */
export type CodigoProximoPasso =
  | 'sem_trilha'
  | 'iniciar'
  | 'fechada'
  | 'preencher_fechamento'
  | 'concluir_etapa'
  | 'registrar_resultado'

export function proximoPasso(estado: {
  trilha?: string
  etapaAtualNome?: string
  proximaEtapaNome?: string
  resultado?: string
  ambiente?: string
  valor?: number | null
}): { codigo: CodigoProximoPasso; texto: string } {
  if (estado.resultado === 'ganha' || estado.resultado === 'perdida') {
    return {
      codigo: 'fechada',
      texto: `Oportunidade ${estado.resultado}. Para retomar o trabalho, reabra a oportunidade informando a justificativa.`,
    }
  }
  if (!estado.trilha) {
    return {
      codigo: 'sem_trilha',
      texto:
        'Defina a complexidade (baixa ou alta) do produto no catálogo — é ela que escolhe as etapas do pipeline.',
    }
  }
  if (!estado.etapaAtualNome) {
    return {
      codigo: 'iniciar',
      texto: 'Clique em “Iniciar pipeline” para entrar na primeira etapa.',
    }
  }
  const faltando = camposFaltantesParaMover(estado.ambiente, estado.valor)
  if (faltando.length > 0) {
    return {
      codigo: 'preencher_fechamento',
      texto: `Antes de avançar, preencha na seção Fechamento: ${faltando.join(' e ')}.`,
    }
  }
  if (estado.proximaEtapaNome) {
    return {
      codigo: 'concluir_etapa',
      texto: `Trabalhe a etapa “${estado.etapaAtualNome}”. Quando terminar, clique em “Concluir etapa”, responda o checklist e a oportunidade segue para “${estado.proximaEtapaNome}”.`,
    }
  }
  return {
    codigo: 'registrar_resultado',
    texto: `Última etapa (“${estado.etapaAtualNome}”). Registre o resultado: ganha ou perdida, com o motivo.`,
  }
}

export interface ItemChecklist {
  id: string
  tipo: 'criterio' | 'insucesso' | 'pergunta'
  texto: string
}

// sinais de insucesso marcados → alerta antes de concluir a etapa
export function insucessosMarcados(itens: ItemChecklist[], marcados: Record<string, boolean>) {
  return itens.filter((i) => i.tipo === 'insucesso' && marcados[i.id])
}

export function resumoCriterios(itens: ItemChecklist[], marcados: Record<string, boolean>) {
  const criterios = itens.filter((i) => i.tipo === 'criterio')
  return { atendidos: criterios.filter((c) => marcados[c.id]).length, total: criterios.length }
}

export interface PassagemEtapa {
  oportunidade: string
  etapa: string
  entrou_em: string
}

export interface TaxaEtapa {
  etapaId: string
  nome: string
  ordem: number
  entraram: number
  avancaram: number
  taxaReal: number | null
  taxaAlvo: number | null
}

/**
 * Taxa de passagem real por etapa (RN-2.3): das oportunidades que ENTRARAM na etapa, quantas
 * chegaram a uma etapa POSTERIOR da mesma trilha. Voltar de etapa não conta como avanço.
 * A última etapa da trilha não tem "próxima" — a taxa fica indisponível (null).
 */
export function calcularTaxasPassagem<T extends EtapaPipeline>(
  etapas: T[],
  trilha: string,
  passagens: PassagemEtapa[],
): TaxaEtapa[] {
  const lista = etapasDaTrilha(etapas, trilha)
  const ordemPorId = new Map(lista.map((e) => [e.id, e.ordem]))
  const maiorOrdem = new Map<string, number>()
  const entrouEm = new Map<string, Set<string>>() // etapa → oportunidades
  for (const p of passagens) {
    const ordem = ordemPorId.get(p.etapa)
    if (ordem === undefined) continue
    if (!entrouEm.has(p.etapa)) entrouEm.set(p.etapa, new Set())
    entrouEm.get(p.etapa)!.add(p.oportunidade)
    maiorOrdem.set(p.oportunidade, Math.max(maiorOrdem.get(p.oportunidade) || 0, ordem))
  }
  const ultima = lista.length > 0 ? lista[lista.length - 1].ordem : 0
  return lista.map((e) => {
    const ops = entrouEm.get(e.id) || new Set<string>()
    const avancaram = [...ops].filter((op) => (maiorOrdem.get(op) || 0) > e.ordem).length
    const temProxima = e.ordem < ultima
    return {
      etapaId: e.id,
      nome: e.nome,
      ordem: e.ordem,
      entraram: ops.size,
      avancaram,
      taxaReal: temProxima && ops.size > 0 ? Math.round((avancaram / ops.size) * 1000) / 10 : null,
      taxaAlvo: typeof e.taxa_alvo === 'number' ? e.taxa_alvo : null,
    }
  })
}

export const META_TAXA_VITORIA = 40 // % — alvo da Bíblia de Vendas (a validar)

export function taxaVitoria(ganhas: number, perdidas: number): number | null {
  const total = ganhas + perdidas
  return total > 0 ? Math.round((ganhas / total) * 1000) / 10 : null
}

export function formatarValor(valor: number | null | undefined, moeda?: string): string {
  if (typeof valor !== 'number' || !(valor > 0)) return '—'
  return valor.toLocaleString(moeda === 'USD' ? 'en-US' : 'pt-BR', {
    style: 'currency',
    currency: moeda === 'USD' ? 'USD' : 'BRL',
  })
}
