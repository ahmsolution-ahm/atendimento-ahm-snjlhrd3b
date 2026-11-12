import { describe, expect, it } from 'vitest'
import {
  chaveDuplicidade,
  detectarDuplicadasNoArquivo,
  mapearCabecalhos,
  telefoneDaLinha,
  validarLinhas,
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
