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

export function formatarValor(valor: number | null | undefined, moeda?: string): string {
  if (typeof valor !== 'number' || !(valor > 0)) return '—'
  return valor.toLocaleString(moeda === 'USD' ? 'en-US' : 'pt-BR', {
    style: 'currency',
    currency: moeda === 'USD' ? 'USD' : 'BRL',
  })
}
