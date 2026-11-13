import { describe, expect, it } from 'vitest'
import {
  camposFaltantesParaMover,
  derivarFechamento,
  etapaVizinha,
  etapasDaTrilha,
  formatarValor,
  rotuloTrilha,
  trilhaDoProduto,
  type EtapaPipeline,
} from './pipeline'

// Pipeline de duas trilhas (emendas 1.2a e 1.2b) — espelho das regras do servidor.

const etapa = (id: string, trilha: 'baixa' | 'alta', ordem: number): EtapaPipeline => ({
  id,
  trilha,
  ordem,
  nome: `${trilha} ${ordem}`,
  fase: 'Venda',
})
const ETAPAS = [
  ...[1, 2, 3, 4, 5].map((o) => etapa(`b${o}`, 'baixa', o)),
  ...[8, 1, 2, 3, 4, 5, 6, 7].map((o) => etapa(`a${o}`, 'alta', o)),
]

describe('fechamento derivado do ambiente', () => {
  it('Venda e Locação em reais → BRL e AHM Brasil', () => {
    expect(derivarFechamento('Venda em reais')).toEqual({ moeda: 'BRL', entidade: 'AHM Brasil' })
    expect(derivarFechamento('Locação em reais')).toEqual({ moeda: 'BRL', entidade: 'AHM Brasil' })
  })

  it('Exportação (EUA) → USD e AHM Solution Americas', () => {
    expect(derivarFechamento('Exportação (EUA)')).toEqual({
      moeda: 'USD',
      entidade: 'AHM Solution Americas',
    })
  })

  it('sem ambiente → vazio', () => {
    expect(derivarFechamento('')).toEqual({ moeda: '', entidade: '' })
  })
})

describe('trilha pela complexidade do produto', () => {
  it('Baixa → AHM Cycle (5 fases); Alta → Site Assessment (8 etapas)', () => {
    expect(trilhaDoProduto('Baixa')).toBe('baixa')
    expect(trilhaDoProduto('Alta')).toBe('alta')
    expect(etapasDaTrilha(ETAPAS, 'baixa')).toHaveLength(5)
    expect(etapasDaTrilha(ETAPAS, 'alta')).toHaveLength(8)
  })

  it('sem complexidade → trilha indefinida', () => {
    expect(trilhaDoProduto(undefined)).toBe('')
    expect(rotuloTrilha('')).toBe('')
  })

  it('etapas em ordem', () => {
    expect(etapasDaTrilha(ETAPAS, 'alta').map((e) => e.ordem)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })
})

describe('navegação entre etapas', () => {
  it('próxima e anterior dentro da trilha', () => {
    expect(etapaVizinha(ETAPAS, 'baixa', 'b2', 1)?.id).toBe('b3')
    expect(etapaVizinha(ETAPAS, 'baixa', 'b2', -1)?.id).toBe('b1')
  })

  it('primeira não tem anterior; última não tem próxima', () => {
    expect(etapaVizinha(ETAPAS, 'alta', 'a1', -1)).toBeNull()
    expect(etapaVizinha(ETAPAS, 'alta', 'a8', 1)).toBeNull()
  })

  it('etapa de outra trilha não é encontrada', () => {
    expect(etapaVizinha(ETAPAS, 'baixa', 'a3', 1)).toBeNull()
  })
})

describe('campos obrigatórios para mudar de etapa', () => {
  it('exige ambiente e valor maior que zero', () => {
    expect(camposFaltantesParaMover('', null)).toEqual(['ambiente de fechamento', 'valor estimado'])
    expect(camposFaltantesParaMover('Venda em reais', 0)).toEqual(['valor estimado'])
    expect(camposFaltantesParaMover('Venda em reais', 15000)).toEqual([])
  })
})

describe('formatação do valor', () => {
  it('BRL e USD', () => {
    expect(formatarValor(1500, 'BRL')).toMatch(/R\$\s?1\.500,00/)
    expect(formatarValor(1500, 'USD')).toBe('$1,500.00')
    expect(formatarValor(0, 'BRL')).toBe('—')
  })
})
