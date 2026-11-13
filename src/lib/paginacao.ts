// Bloco 5 (0.0.59, D2): leitura paginada com CONFERÊNCIA DE COBERTURA (função pura — a busca
// de cada página é injetada, então a regra é testável sem acessar a base).
// Regra: o total é contado na 1ª página; toda página intermediária precisa vir completa e a
// soma lida precisa alcançar o total. Qualquer desvio → erro (nunca "passa" com leitura parcial).

export interface PaginaLida<T> {
  items: T[]
  totalItems: number
  totalPages: number
}

export async function lerTodasPaginas<T>(
  buscar: (pagina: number, comTotal: boolean) => Promise<PaginaLida<T>>,
  porPagina: number,
  aoLer: (itens: T[]) => void,
): Promise<number> {
  const primeira = await buscar(1, true)
  const total = primeira.totalItems
  const paginas = primeira.totalPages
  if (!Array.isArray(primeira.items) || typeof total !== 'number' || total < 0) {
    throw new Error('Resposta inesperada ao ler a base de leads.')
  }
  if (paginas > 1 && primeira.items.length < porPagina) {
    throw new Error('Leitura incompleta da base de leads (página 1 veio parcial).')
  }
  let lidos = primeira.items.length
  aoLer(primeira.items)
  for (let p = 2; p <= paginas; p++) {
    const r = await buscar(p, false)
    if (!Array.isArray(r.items)) {
      throw new Error(`Resposta inesperada ao ler a base de leads (página ${p}).`)
    }
    if (p < paginas && r.items.length < porPagina) {
      throw new Error(`Leitura incompleta da base de leads (página ${p} veio parcial).`)
    }
    lidos += r.items.length
    aoLer(r.items)
  }
  if (lidos < total) {
    throw new Error(`Leitura incompleta da base de leads (${lidos} de ${total} registros).`)
  }
  return lidos
}

// repete uma operação com espera crescente; erros considerados definitivos não são repetidos
export async function comTentativas<T>(
  operacao: () => Promise<T>,
  tentativas: number,
  definitivo: (err: unknown) => boolean,
  esperaMs: (err: unknown, tentativa: number) => number,
  esperar: (ms: number) => Promise<unknown> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<T> {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await operacao()
    } catch (err) {
      if (tentativa >= tentativas || definitivo(err)) throw err
      await esperar(esperaMs(err, tentativa))
    }
  }
}
