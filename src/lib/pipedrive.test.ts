import { describe, expect, it } from 'vitest'
import { chaveLead, classificarMotivo, dataPb, mapearNegocios, normalizar } from './pipedrive'

// Bloco D — regras de mapeamento da importação do Pipedrive (a conferência com a planilha real
// do owner — 10.906 negócios → 3.541 oportunidades, 4.753 leads, 2.612 fora — foi feita à parte,
// sem versionar o arquivo, que contém dados de clientes).

describe('normalização', () => {
  it('tira acentos, maiúsculas e pontuação', () => {
    expect(normalizar('  Indústria  Ação S/A. ')).toBe('industria acao s a')
    expect(chaveLead('Arkema', 'Eduardo Zuin')).toBe('arkema|eduardo zuin')
  })
})

describe('motivos de perda', () => {
  it('casa a lista exata, sinônimos e guarda o resto', () => {
    expect(classificarMotivo('Sem retorno do cliente')).toEqual({
      motivo: 'Sem retorno do cliente',
      observacao: '',
    })
    expect(classificarMotivo('DUPLICIDADE')).toEqual({ motivo: 'Duplicidade', observacao: '' })
    expect(classificarMotivo('Duplicado').motivo).toBe('Duplicidade')
    expect(classificarMotivo('Barreira tecnógica').motivo).toBe('Barreira tecnológica')
    expect(classificarMotivo('Empresa não está no momento para implantação').motivo).toBe(
      'Empresa não está no momento',
    )
    expect(classificarMotivo('Budget')).toEqual({ motivo: null, observacao: 'Budget' })
    expect(classificarMotivo('')).toEqual({ motivo: null, observacao: '' })
  })
})

describe('mapeamento dos negócios', () => {
  const base = {
    ID: '1',
    Título: 'Projeto X',
    Proprietário: 'Rose Freitas',
    Valor: '1000',
    'Moeda de Valor': 'BRL',
    Organização: 'Empresa Ã',
    Contact: 'Maria',
    Etapa: 'Fechamento',
    Status: 'Ganho',
    'Negócio criado em': '2020-01-02 10:00:00',
    'Ganho em': '2020-03-04 11:00:00',
    'Última alteração de etapa': '2020-03-01 09:00:00',
    Funil: '[PD] Comercial',
  }
  it('Fechamento vai para Negociação (ordem 5) e o ganho guarda a data', () => {
    const { itens } = mapearNegocios([base])
    expect(itens[0].ordem_etapa).toBe(5)
    expect(itens[0].resultado).toBe('ganha')
    expect(itens[0].fechado_em).toBe('2020-03-04 11:00:00.000Z')
    expect(itens[0].criado_em).toBe(dataPb('2020-01-02 10:00:00'))
  })
  it('euro não vira valor no CRM; Conversa Abandonada fica fora; Pré-vendas vira lead', () => {
    const r = mapearNegocios([
      { ...base, ID: '2', 'Moeda de Valor': 'EUR' },
      { ...base, ID: '3', Funil: 'Conversa Abandonada' },
      { ...base, ID: '4', Funil: '[PD] Pré-vendas', Etapa: 'Entrada de Leads', Status: 'Aberto' },
    ])
    expect(r.itens.find((i) => i.pipedrive_id === '2')).toMatchObject({
      valor: 0,
      moeda: '',
      valor_original: 1000,
      moeda_original: 'EUR',
    })
    expect(r.descartes.map((d) => d.pipedrive_id)).toEqual(['3'])
    expect(r.itens.find((i) => i.pipedrive_id === '4')?.tipo).toBe('lead')
  })
  it('etapa sem equivalência não entra', () => {
    const r = mapearNegocios([{ ...base, ID: '5', Etapa: 'Etapa Nova' }])
    expect(r.itens).toHaveLength(0)
    expect(r.descartes[0].motivo).toContain('Etapa sem equivalência')
  })
})
