// F1-T16 — SPEC 1.6: cálculo dos indicadores (funções PURAS — sem acesso à base, testáveis).
// Os nomes internos (K1/K2/K3) ficam só no código; a tela usa os nomes de negócio.
//   K1 (RN-1.16/1.17): leads qualificados automaticamente / leads recebidos no recorte piloto.
//   K2 (RN-1.18): média de interações humanas (não canceladas) até a proposta.
//   K3 (RN-1.19): leads processados por vendedor; sem responsável = pendência de dados.
import type { InteracaoRecord } from '@/types'

// amostra mínima para o percentual de qualificação automática ser considerado representativo
export const AMOSTRA_MINIMA_K1 = 10
export const META_K1 = 70 // %
export const REFERENCIA_K2 = 8 // interações até a proposta antes da solução
export const META_K2 = 4

export interface ResultadoK1 {
  percentual: number | null
  numerador: number
  denominador: number
  suficiente: boolean
}

export function calcularK1(qualificadosAuto: number, recebidosRecorte: number): ResultadoK1 {
  if (recebidosRecorte <= 0) {
    return { percentual: null, numerador: qualificadosAuto, denominador: 0, suficiente: false }
  }
  const percentual = Math.round((qualificadosAuto / recebidosRecorte) * 1000) / 10
  return {
    percentual,
    numerador: qualificadosAuto,
    denominador: recebidosRecorte,
    suficiente: recebidosRecorte >= AMOSTRA_MINIMA_K1,
  }
}

/**
 * F1-T20 (CA-1-020): nº de interações NÃO canceladas até (inclusive) a que tem proposta.
 * Retorna null quando não há proposta ativa — diferente de "proposta na 1ª interação".
 * Ordem cronológica: data e, em empate (mesmo dia), ordem de registro.
 */
export function calcularAteProposta(
  itens: Pick<InteracaoRecord, 'data' | 'created' | 'proposta' | 'cancelada'>[],
): number | null {
  const ativas = itens
    .filter((i) => !i.cancelada)
    .sort((a, b) => {
      const d = a.data.localeCompare(b.data)
      return d !== 0 ? d : a.created.localeCompare(b.created)
    })
  const idx = ativas.findIndex((i) => i.proposta)
  return idx >= 0 ? idx + 1 : null
}

export interface ResultadoK2 {
  media: number | null
  leadsComProposta: number
  totalInteracoes: number
}

export function calcularK2(contagens: (number | null)[]): ResultadoK2 {
  const validas = contagens.filter((c): c is number => typeof c === 'number' && c > 0)
  if (validas.length === 0) return { media: null, leadsComProposta: 0, totalInteracoes: 0 }
  const total = validas.reduce((s, c) => s + c, 0)
  return {
    media: Math.round((total / validas.length) * 10) / 10,
    leadsComProposta: validas.length,
    totalInteracoes: total,
  }
}

export interface VendedorProcessados {
  id: string
  nome: string
  processados: number
}

export interface ResultadoK3 {
  mediaPorVendedor: number | null
  vendedores: VendedorProcessados[]
  totalProcessados: number
  semResponsavel: number
}

export function calcularK3(vendedores: VendedorProcessados[], semResponsavel: number): ResultadoK3 {
  const ativos = vendedores
    .filter((v) => v.processados > 0)
    .sort((a, b) => b.processados - a.processados)
  const total = ativos.reduce((s, v) => s + v.processados, 0)
  return {
    mediaPorVendedor: ativos.length > 0 ? Math.round((total / ativos.length) * 10) / 10 : null,
    vendedores: ativos,
    totalProcessados: total,
    semResponsavel,
  }
}

// junta partes de uma expressão de filtro do PocketBase com &&, ignorando partes vazias
export function juntarFiltros(...partes: (string | undefined | null)[]): string {
  return partes
    .filter((p): p is string => !!p && p.trim() !== '')
    .map((p) => `(${p})`)
    .join(' && ')
}

// data limite (início do período) no formato aceito pelos filtros do PocketBase
export function inicioDoPeriodo(dias: number | null, agora: Date = new Date()): string | null {
  if (dias === null) return null
  const d = new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000)
  return `${d.toISOString().slice(0, 10)} 00:00:00`
}

export const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
