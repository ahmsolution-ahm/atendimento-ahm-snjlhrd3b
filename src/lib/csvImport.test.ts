import { describe, expect, it } from 'vitest'
import {
  chaveDuplicidade,
  chavesDoRegistroBase,
  detectarDuplicadasNoArquivo,
  mapearCabecalhos,
  mensagemImportacao,
  selecionarNovos,
  telefoneDaLinha,
  validarLinhas,
  type CsvLeadRow,
} from './csvImport'

// Importação CSV — telefone (Bloco 4) e chave de duplicidade.

describe('mapeamento de cabeçalhos de telefone', () => {
  it('telefone, phone e fone → telefone; celular, mobile e whatsapp → celular', () => {
    expect(mapearCabecalhos(['Telefone', 'Phone', 'Fone', 'Telefone Principal'])).toEqual([
      'telefone',
      'telefone',
      'telefone',
      'telefone',
    ])
    expect(mapearCabecalhos(['Celular', 'Mobile', 'WhatsApp'])).toEqual([
      'celular',
      'celular',
      'celular',
    ])
  })

  it('arquivo sem coluna de telefone não quebra a validação', () => {
    const mapa = mapearCabecalhos(['Nome', 'Empresa', 'Email'])
    const { validas } = validarLinhas([['Ana', 'Alfa', 'ana@alfa.com.br']], mapa)
    expect(validas[0].telefone).toBeUndefined()
    expect(telefoneDaLinha(validas[0])).toBe('')
  })
})

describe('telefone do lead', () => {
  it('usa o telefone principal; na falta dele, o celular', () => {
    expect(telefoneDaLinha({ telefone: '(11) 3333-4444', celular: '(11) 98765-4321' })).toBe(
      '(11) 3333-4444',
    )
    expect(telefoneDaLinha({ celular: ' (11) 98765-4321 ' })).toBe('(11) 98765-4321')
  })
})

describe('chave de duplicidade', () => {
  it('ignora maiúsculas e espaços nas pontas', () => {
    expect(chaveDuplicidade(' Ana@Alfa.com.br ', 'ALFA ')).toBe(
      chaveDuplicidade('ana@alfa.com.br', 'alfa'),
    )
  })

  it('mesmo contato em empresas diferentes não é duplicidade', () => {
    expect(chaveDuplicidade('ana@alfa.com.br', 'Alfa')).not.toBe(
      chaveDuplicidade('ana@alfa.com.br', 'Beta'),
    )
  })

  it('linha sem contato usa nome + empresa (rascunho não é regravado)', () => {
    expect(chaveDuplicidade('', 'Alfa', 'Ana Souza')).toBe(
      chaveDuplicidade(' ', 'ALFA', 'ana souza'),
    )
    expect(chaveDuplicidade('', 'Alfa', 'Ana Souza')).not.toBe(
      chaveDuplicidade('', 'Alfa', 'Bruno'),
    )
  })

  it('duplicadas no arquivo usam a mesma chave', () => {
    const base = { nome: 'Ana', linha: 2, origem: 'Importação CSV' }
    const dups = detectarDuplicadasNoArquivo([
      { ...base, empresa: 'Alfa', contato: 'ana@alfa.com.br' },
      { ...base, empresa: 'ALFA', contato: 'ANA@alfa.com.br', linha: 3 },
      { ...base, empresa: 'Beta', contato: 'ana@alfa.com.br', linha: 4 },
    ])
    expect(dups.map((d) => d.linha)).toEqual([3])
  })
})

// Bloco 5: importação incremental — só os novos são gravados
const linha = (linhaN: number, contato: string, empresa: string, nome = 'Contato'): CsvLeadRow => ({
  nome,
  empresa,
  contato,
  linha: linhaN,
  origem: 'Importação CSV',
})

describe('seleção dos leads novos', () => {
  it('cenário do critério de aceite: 1 nova, 1 duplicada da base, 1 repetida no arquivo', () => {
    const base = new Set([chaveDuplicidade('existe@alfa.com.br', 'Alfa')])
    const r = selecionarNovos(
      [
        linha(2, 'nova@beta.com.br', 'Beta'),
        linha(3, 'EXISTE@alfa.com.br', 'alfa'),
        linha(4, 'nova@beta.com.br', 'BETA'),
      ],
      base,
    )
    expect(r.novos.map((l) => l.linha)).toEqual([2])
    expect(r.duplicadasNaBase.map((l) => l.linha)).toEqual([3])
    expect(r.duplicadasNoArquivo.map((l) => l.linha)).toEqual([4])
  })

  it('repetida no arquivo: a primeira ocorrência grava', () => {
    const r = selecionarNovos(
      [linha(2, 'a@x.com', 'X'), linha(3, 'a@x.com', 'X'), linha(4, 'a@x.com', 'X')],
      new Set(),
    )
    expect(r.novos.map((l) => l.linha)).toEqual([2])
    expect(r.duplicadasNoArquivo).toHaveLength(2)
  })

  it('linha repetida no arquivo que também existe na base conta como já existente', () => {
    const base = new Set([chaveDuplicidade('a@x.com', 'X')])
    const r = selecionarNovos([linha(2, 'a@x.com', 'X'), linha(3, 'a@x.com', 'X')], base)
    expect(r.novos).toHaveLength(0)
    expect(r.duplicadasNaBase).toHaveLength(2)
  })

  it('reimportação da mesma base: nenhum novo', () => {
    const arquivo = [linha(2, 'a@x.com', 'X'), linha(3, '', 'Y', 'Rascunho Sem Email')]
    const base = new Set(arquivo.map((l) => chaveDuplicidade(l.contato, l.empresa, l.nome)))
    expect(selecionarNovos(arquivo, base).novos).toHaveLength(0)
  })

  // D1 (0.0.59): cenário da prova do Bart — linha sem e-mail de um lead que existe COM e-mail
  it('linha sem e-mail reconhece lead da base cadastrado com e-mail (nome + empresa)', () => {
    const base = new Set(
      chavesDoRegistroBase('aroldo@stellantis.com', 'Stellantis (Mopar)', 'Aroldo Teles da Silva'),
    )
    const r = selecionarNovos([linha(2, '', 'Stellantis (Mopar)', 'AROLDO TELES DA SILVA')], base)
    expect(r.novos).toHaveLength(0)
    expect(r.duplicadasNaBase).toHaveLength(1)
  })

  it('mesmo nome e empresa com OUTRO e-mail continua sendo lead novo', () => {
    const base = new Set(chavesDoRegistroBase('ana@alfa.com.br', 'Alfa', 'Ana Souza'))
    const r = selecionarNovos([linha(2, 'ana.souza@alfa.com.br', 'Alfa', 'Ana Souza')], base)
    expect(r.novos).toHaveLength(1)
  })

  it('no próprio arquivo: linha sem e-mail depois da mesma pessoa com e-mail é repetida', () => {
    const r = selecionarNovos(
      [linha(2, 'ana@alfa.com.br', 'Alfa', 'Ana Souza'), linha(3, '', 'Alfa', 'Ana Souza')],
      new Set(),
    )
    expect(r.novos.map((l) => l.linha)).toEqual([2])
    expect(r.duplicadasNoArquivo.map((l) => l.linha)).toEqual([3])
  })

  it('registro da base sem nome não gera chave secundária (não casa rascunhos genéricos)', () => {
    expect(chavesDoRegistroBase('a@x.com', 'X', '')).toEqual([chaveDuplicidade('a@x.com', 'X')])
  })

  it('todas as válidas caem em exatamente um grupo', () => {
    const validas = [linha(2, 'a@x.com', 'X'), linha(3, 'b@x.com', 'X'), linha(4, 'a@x.com', 'X')]
    const r = selecionarNovos(validas, new Set([chaveDuplicidade('b@x.com', 'X')]))
    expect(r.novos.length + r.duplicadasNaBase.length + r.duplicadasNoArquivo.length).toBe(
      validas.length,
    )
  })
})

describe('relatório da importação', () => {
  it('plural correto', () => {
    expect(mensagemImportacao(1, 2, 0)).toBe(
      '1 novo lead importado. 2 já existentes foram ignorados.',
    )
    expect(mensagemImportacao(2, 1, 0)).toBe(
      '2 novos leads importados. 1 já existente foi ignorado.',
    )
  })

  it('sem ignorados e com erros', () => {
    expect(mensagemImportacao(5, 0, 0)).toBe('5 novos leads importados.')
    expect(mensagemImportacao(3, 0, 1)).toBe('3 novos leads importados. 1 não importado por erro.')
    expect(mensagemImportacao(0, 4, 2)).toBe(
      'Nenhum lead novo importado. 4 já existentes foram ignorados. 2 não importados por erro.',
    )
  })

  it('números grandes com separador de milhar', () => {
    expect(mensagemImportacao(0, 15370, 0)).toBe(
      'Nenhum lead novo importado. 15.370 já existentes foram ignorados.',
    )
  })
})
