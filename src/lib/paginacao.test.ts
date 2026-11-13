import { describe, expect, it } from 'vitest'
import { comTentativas, lerTodasPaginas, type PaginaLida } from './paginacao'

// D2 (0.0.59): a verificação de duplicidade nunca pode "passar" com leitura parcial da base.

// simula uma base de N registros servida em páginas; "defeitos" alteram páginas específicas
function baseFalsa(total: number, porPagina: number, defeitos: Record<number, number> = {}) {
  const totalPages = Math.ceil(total / porPagina)
  return async (pagina: number, comTotal: boolean): Promise<PaginaLida<number>> => {
    const inicio = (pagina - 1) * porPagina
    let qtd = Math.max(0, Math.min(porPagina, total - inicio))
    if (pagina in defeitos) qtd = defeitos[pagina]
    return {
      items: Array.from({ length: qtd }, (_, i) => inicio + i),
      totalItems: comTotal ? total : -1,
      totalPages: comTotal ? totalPages : -1,
    }
  }
}

describe('leitura paginada com conferência de cobertura', () => {
  it('lê a base inteira (15.370 registros em páginas de 1.000)', async () => {
    const lidos: number[] = []
    const n = await lerTodasPaginas(baseFalsa(15370, 1000), 1000, (it) => lidos.push(...it))
    expect(n).toBe(15370)
    expect(lidos).toHaveLength(15370)
  })

  it('página intermediária parcial → erro (cenário do incidente)', async () => {
    await expect(
      lerTodasPaginas(baseFalsa(15370, 1000, { 5: 120 }), 1000, () => {}),
    ).rejects.toThrow(/página 5 veio parcial/)
  })

  it('1ª página parcial com mais páginas → erro', async () => {
    await expect(lerTodasPaginas(baseFalsa(3000, 1000, { 1: 10 }), 1000, () => {})).rejects.toThrow(
      /página 1 veio parcial/,
    )
  })

  it('última página curta demais (soma abaixo do total) → erro', async () => {
    await expect(
      lerTodasPaginas(baseFalsa(2500, 1000, { 3: 100 }), 1000, () => {}),
    ).rejects.toThrow(/2100 de 2500/)
  })

  it('base vazia → zero registros, sem erro', async () => {
    expect(await lerTodasPaginas(baseFalsa(0, 1000), 1000, () => {})).toBe(0)
  })

  it('resposta sem lista de itens → erro', async () => {
    const quebrada = async () => ({ items: undefined, totalItems: 10, totalPages: 1 }) as never
    await expect(lerTodasPaginas(quebrada, 1000, () => {})).rejects.toThrow(/inesperada/)
  })

  it('falha de página propaga o erro (a tela bloqueia a importação)', async () => {
    const falha = async (p: number) => {
      if (p === 2) throw new Error('rede')
      return { items: [1, 2], totalItems: 4, totalPages: 2 }
    }
    await expect(lerTodasPaginas(falha, 2, () => {})).rejects.toThrow('rede')
  })
})

describe('tentativas por página', () => {
  const semEspera = async () => {}

  it('falha temporária seguida de sucesso → resultado', async () => {
    let chamadas = 0
    const r = await comTentativas(
      async () => {
        chamadas++
        if (chamadas < 3) throw { status: 503 }
        return 'ok'
      },
      4,
      () => false,
      () => 0,
      semEspera,
    )
    expect(r).toBe('ok')
    expect(chamadas).toBe(3)
  })

  it('esgota as tentativas → erro', async () => {
    let chamadas = 0
    await expect(
      comTentativas(
        async () => {
          chamadas++
          throw { status: 429 }
        },
        4,
        () => false,
        () => 0,
        semEspera,
      ),
    ).rejects.toEqual({ status: 429 })
    expect(chamadas).toBe(4)
  })

  it('erro definitivo não é repetido', async () => {
    let chamadas = 0
    await expect(
      comTentativas(
        async () => {
          chamadas++
          throw { status: 400 }
        },
        4,
        (e) => (e as { status: number }).status === 400,
        () => 0,
        semEspera,
      ),
    ).rejects.toEqual({ status: 400 })
    expect(chamadas).toBe(1)
  })
})
