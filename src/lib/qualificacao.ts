// F1-T07 — SPEC 1.3: motor de qualificação local (regras transparentes, sem IA/API).
// Entrada: lead + produto (expandido). Saída: status + motivos + pendências legíveis.
// RN-1.7: produto ativo + dor + urgência → qualificado
// RN-1.8: falta resposta obrigatória → pendente (com lista de pendências)
// RN-1.9: produto fora do recorte piloto → fora do recorte
// RN-1.10: sinal técnico complexo → transbordo (estado aqui; fila na F1-T10)
// Nota: "dor compatível" nesta fase = dor preenchida (calibração com uso real, como a SPEC prevê).

export interface ProdutoQualificacao {
  id: string
  nome: string
  status: string
  complexidade?: string
  familia_tecnologica?: string
}

export interface LeadQualificacao {
  id: string
  nome: string
  empresa: string
  contato: string
  produto_interesse?: string
  dor?: string
  urgencia?: string
  origem?: string
  status: string
  incompleto?: boolean
}

export interface ResultadoQualificacao {
  status: 'qualificado' | 'pendente' | 'fora do recorte' | 'transbordo'
  motivos: string[]
  pendencias: string[]
}

// sinais de complexidade técnica na dor — RN-1.10 (transbordo para especialista)
// CORREÇÃO F1-T10: comparação sem acentos — "integração" (ç) não casava com "integrac" (c)
// e o lead virava qualificado em vez de transbordo. Normalizar os DOIS lados.
const normalizarAcentos = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const SINAIS_COMPLEXOS = [
  'integrac', // integração com sistemas
  'automac', // automação complexa
  'personalizad', // solução personalizada
  'multisite', // múltiplas unidades
  'multi-site',
  'vários sites',

export function qualificar(
=======
  'diversas plantas',
]

export function qualificar(
=======

export function qualificar(
  lead: LeadQualificacao,
  produto: ProdutoQualificacao | null,
): ResultadoQualificacao {
  const motivos: string[] = []
  const pendencias: string[] = []

  // RN-1.6 (reforço): sem produto de interesse → pendente
  if (!produto) {
    pendencias.push('produto de interesse não selecionado')
    return {
      status: 'pendente',
      motivos: ['lead sem produto de interesse — qualificação não pode prosseguir (RN-1.6)'],
      pendencias,
    }
  }

  // produto inativo/inexistente → bloqueio (tratamento completo na F1-T09; aqui protege o motor)
  if (produto.status !== 'Ativo') {
    return {
      status: 'pendente',
      motivos: [
        `produto "${produto.nome}" não está ativo no catálogo — selecione um produto ativo`,
      ],
      pendencias: ['produto ativo para qualificar'],
    }
  }

  // RN-1.9: fora do recorte piloto (baixa complexidade é o recorte da Fase 1)
  if (produto.complexidade === 'Alta') {
    return {
      status: 'fora do recorte',
      motivos: [
        `produto "${produto.nome}" é de alta complexidade — fora do recorte piloto da Fase 1 (RN-1.9); segue visível para análise`,
      ],
      pendencias: [],
    }
  }

  // RN-1.10: sinais técnicos complexos na dor → transbordo (comparação sem acentos)
  const dor = normalizarAcentos(lead.dor || '')
  const sinalComplexo = SINAIS_COMPLEXOS.map(normalizarAcentos).find((s) => dor.includes(s))
  if (sinalComplexo) {
    return {
      status: 'transbordo',
      motivos: [
        `dor menciona sinal técnico complexo ("${sinalComplexo}") — exige especialista (RN-1.10)`,
        `produto: ${produto.nome}`,
      ],
      pendencias: [],
    }
  }

  // RN-1.7: produto ativo + dor + urgência → qualificado
  if (!lead.dor || !lead.dor.trim()) pendencias.push('dor / necessidade não informada')
  if (!lead.urgencia || !lead.urgencia.trim()) pendencias.push('urgência não informada')

  if (pendencias.length > 0) {
    return {
      status: 'pendente',
      motivos: [
        `produto ativo: ${produto.nome}`,
        'faltam respostas obrigatórias para qualificar (RN-1.8)',
      ],
      pendencias,
    }
  }

  motivos.push(`produto ativo: ${produto.nome}`)
  motivos.push('dor informada — sinal de necessidade (RN-1.7)')
  motivos.push(`urgência ${lead.urgencia}`)
  return { status: 'qualificado', motivos, pendencias: [] }
}

// justificativa legível (uma linha) — gravada em qualificacao_resultado
export function justificativa(r: ResultadoQualificacao): string {
  const motivos = r.motivos.join('; ')
  if (r.pendencias.length > 0) {
    return `${motivos}. Pendências: ${r.pendencias.join('; ')}.`
  }
  return motivos + '.'
}
