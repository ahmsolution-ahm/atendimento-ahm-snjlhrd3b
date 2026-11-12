import { describe, expect, it } from 'vitest'
import {
  calcularAteProposta,
  calcularK1,
  calcularK2,
  calcularK3,
  inicioDoPeriodo,
  juntarFiltros,
  plural,
} from './metricas'

// Indicadores do painel (SPEC 1.6) e contagem até a proposta (SPEC 1.7).

const it_ = (
  data: string,
  created: string,
  extra: { proposta?: boolean; cancelada?: boolean } = {},
) => ({
  data: `${data} 12:00:00.000Z`,
  created: `${created}`,
  proposta: false,
  cancelada: false,
  ...extra,
})

describe('interações até a proposta', () => {
  it('sem proposta → null (diferente de zero)', () => {
    expect(calcularAteProposta([it_('2026-11-01', 'a'), it_('2026-11-02', 'b')])).toBeNull()
  })

  it('conta até a proposta, inclusive, em ordem cronológica', () => {
    const itens = [
      it_('2026-11-05', 'e', { proposta: true }),
      it_('2026-11-01', 'a'),
      it_('2026-11-03', 'c'),
      it_('2026-11-08', 'f'), // depois da proposta: não conta
    ]
    expect(calcularAteProposta(itens)).toBe(3)
  })

  it('interação cancelada sai da contagem', () => {
    const itens = [
      it_('2026-11-01', 'a'),
      it_('2026-11-02', 'b', { cancelada: true }),
      it_('2026-11-03', 'c', { proposta: true }),
    ]
    expect(calcularAteProposta(itens)).toBe(2)
  })

  it('proposta cancelada → volta a "sem proposta"', () => {
    const itens = [
      it_('2026-11-01', 'a'),
      it_('2026-11-02', 'b', { proposta: true, cancelada: true }),
    ]
    expect(calcularAteProposta(itens)).toBeNull()
  })

  it('mesmo dia: desempate pela ordem de registro', () => {
    const itens = [
      it_('2026-11-01', '2026-11-01 10:00:00', { proposta: true }),
      it_('2026-11-01', '2026-11-01 15:00:00'),
    ]
    expect(calcularAteProposta(itens)).toBe(1)
  })
})

describe('qualificação automática', () => {
  it('sem leads no recorte → insuficiente, sem divisão por zero', () => {
    const r = calcularK1(0, 0)
    expect(r.percentual).toBeNull()
    expect(r.suficiente).toBe(false)
  })

  it('7 de 10 → 70% com amostra suficiente', () => {
    expect(calcularK1(7, 10)).toEqual({
      percentual: 70,
      numerador: 7,
      denominador: 10,
      suficiente: true,
    })
  })

  it('amostra pequena calcula mas sinaliza', () => {
    const r = calcularK1(1, 3)
    expect(r.percentual).toBe(33.3)
    expect(r.suficiente).toBe(false)
  })
})

describe('média de interações até a proposta', () => {
  it('ignora leads sem proposta (null)', () => {
    expect(calcularK2([3, 4, 5, null])).toEqual({
      media: 4,
      leadsComProposta: 3,
      totalInteracoes: 12,
    })
  })

  it('sem propostas → média null', () => {
    expect(calcularK2([null, null]).media).toBeNull()
  })
})

describe('capacidade por vendedor', () => {
  it('média só entre vendedores com leads processados', () => {
    const r = calcularK3(
      [
        { id: 'a', nome: 'Ana', processados: 10 },
        { id: 'b', nome: 'Bia', processados: 5 },
        { id: 'c', nome: 'Caio', processados: 0 },
      ],
      2,
    )
    expect(r.mediaPorVendedor).toBe(7.5)
    expect(r.vendedores.map((v) => v.nome)).toEqual(['Ana', 'Bia'])
    expect(r.semResponsavel).toBe(2)
  })

  it('ninguém processou → média null', () => {
    expect(calcularK3([{ id: 'a', nome: 'Ana', processados: 0 }], 0).mediaPorVendedor).toBeNull()
  })
})

describe('utilitários', () => {
  it('juntarFiltros ignora partes vazias', () => {
    expect(juntarFiltros("status = 'a'", '', undefined, 'x = 1')).toBe("(status = 'a') && (x = 1)")
    expect(juntarFiltros('', null)).toBe('')
  })

  it('inicioDoPeriodo', () => {
    expect(inicioDoPeriodo(null)).toBeNull()
    expect(inicioDoPeriodo(7, new Date('2026-11-12T15:00:00Z'))).toBe('2026-11-05 00:00:00')
  })

  it('plural correto', () => {
    expect(plural(1, 'item', 'itens')).toBe('1 item')
    expect(plural(2, 'item', 'itens')).toBe('2 itens')
  })
})
