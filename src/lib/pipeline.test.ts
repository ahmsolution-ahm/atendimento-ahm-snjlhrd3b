import { describe, expect, it } from 'vitest'
import {
  calcularTaxasPassagem,
  camposFaltantesParaMover,
  derivarFechamento,
  etapaVizinha,
  etapasDaTrilha,
  formatarValor,
  insucessosMarcados,
  proximoPasso,
  resumoCriterios,
  rotuloTrilha,
  taxaVitoria,
  trilhaDoProduto,
  type EtapaPipeline,
  type ItemChecklist,
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

// Fase 2 · Bloco 2
describe('próximo passo guiado', () => {
  const base = {
    trilha: 'baixa',
    etapaAtualNome: 'Problema Emergente',
    proximaEtapaNome: 'Diagnóstico',
  }

  it('sem trilha → orienta a definir a complexidade do produto', () => {
    expect(proximoPasso({}).codigo).toBe('sem_trilha')
  })

  it('sem etapa → iniciar pipeline', () => {
    expect(proximoPasso({ trilha: 'alta' }).codigo).toBe('iniciar')
  })

  it('sem fechamento → preencher ambiente e valor', () => {
    const p = proximoPasso({ ...base, ambiente: '', valor: 0 })
    expect(p.codigo).toBe('preencher_fechamento')
    expect(p.texto).toContain('ambiente de fechamento e valor estimado')
  })

  it('com fechamento → concluir a etapa e seguir', () => {
    const p = proximoPasso({ ...base, ambiente: 'Venda em reais', valor: 1000 })
    expect(p.codigo).toBe('concluir_etapa')
    expect(p.texto).toContain('“Diagnóstico”')
  })

  it('última etapa → registrar o resultado', () => {
    expect(
      proximoPasso({ trilha: 'baixa', etapaAtualNome: 'Fim', ambiente: 'Venda em reais', valor: 1 })
        .codigo,
    ).toBe('registrar_resultado')
  })

  it('fechada → reabrir', () => {
    expect(proximoPasso({ ...base, resultado: 'ganha' }).codigo).toBe('fechada')
  })
})

describe('checklist da etapa', () => {
  const itens: ItemChecklist[] = [
    { id: 'c1', tipo: 'criterio', texto: 'Critério 1' },
    { id: 'c2', tipo: 'criterio', texto: 'Critério 2' },
    { id: 'i1', tipo: 'insucesso', texto: 'Sem meta definida' },
    { id: 'p1', tipo: 'pergunta', texto: 'Pergunta' },
  ]

  it('alerta só para sinais de insucesso marcados', () => {
    expect(insucessosMarcados(itens, { c1: true })).toHaveLength(0)
    expect(insucessosMarcados(itens, { i1: true }).map((i) => i.id)).toEqual(['i1'])
  })

  it('resumo dos critérios atendidos', () => {
    expect(resumoCriterios(itens, { c1: true, i1: true })).toEqual({ atendidos: 1, total: 2 })
  })
})

describe('taxas de passagem real × alvo', () => {
  const etapasAlvo = [1, 2, 3].map((o) => ({
    ...etapa(`b${o}`, 'baixa', o),
    taxa_alvo: [60, 70, 90][o - 1],
  }))

  it('conta quem chegou a uma etapa posterior da mesma trilha', () => {
    const passagens = [
      { oportunidade: 'A', etapa: 'b1', entrou_em: '1' },
      { oportunidade: 'A', etapa: 'b2', entrou_em: '2' },
      { oportunidade: 'B', etapa: 'b1', entrou_em: '1' },
      { oportunidade: 'C', etapa: 'b1', entrou_em: '1' },
      { oportunidade: 'C', etapa: 'b2', entrou_em: '2' },
      { oportunidade: 'C', etapa: 'b3', entrou_em: '3' },
    ]
    const t = calcularTaxasPassagem(etapasAlvo, 'baixa', passagens)
    expect(t[0]).toMatchObject({ entraram: 3, avancaram: 2, taxaReal: 66.7, taxaAlvo: 60 })
    expect(t[1]).toMatchObject({ entraram: 2, avancaram: 1, taxaReal: 50 })
    expect(t[2]).toMatchObject({ entraram: 1, taxaReal: null }) // última etapa
  })

  it('voltar de etapa não conta como avanço', () => {
    const passagens = [
      { oportunidade: 'A', etapa: 'b2', entrou_em: '1' },
      { oportunidade: 'A', etapa: 'b1', entrou_em: '2' },
    ]
    const t = calcularTaxasPassagem(etapasAlvo, 'baixa', passagens)
    expect(t[1]).toMatchObject({ entraram: 1, avancaram: 0, taxaReal: 0 })
  })

  it('sem passagens → taxas indisponíveis, sem erro', () => {
    const t = calcularTaxasPassagem(etapasAlvo, 'baixa', [])
    expect(t.every((l) => l.taxaReal === null && l.entraram === 0)).toBe(true)
  })

  it('taxa de vitória', () => {
    expect(taxaVitoria(2, 3)).toBe(40)
    expect(taxaVitoria(0, 0)).toBeNull()
  })
})

describe('formatação do valor', () => {
  it('BRL e USD', () => {
    expect(formatarValor(1500, 'BRL')).toMatch(/R\$\s?1\.500,00/)
    expect(formatarValor(1500, 'USD')).toBe('$1,500.00')
    expect(formatarValor(0, 'BRL')).toBe('—')
  })
})
