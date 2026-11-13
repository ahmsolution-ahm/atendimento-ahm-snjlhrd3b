import { describe, expect, it } from 'vitest'
import {
  familiasPorArea,
  qualificar,
  justificativa,
  sugestaoFamilias,
  type LeadQualificacao,
} from './qualificacao'

// Regras do motor de qualificação (SPEC 1.3) — protege contra regressão a cada versão.

const lead = (extra: Partial<LeadQualificacao> = {}): LeadQualificacao => ({
  id: 'l1',
  nome: 'Contato',
  empresa: 'Empresa',
  contato: 'contato@empresa.com.br',
  status: 'novo',
  dor: 'Avarias no transporte',
  urgencia: 'Alta',
  ...extra,
})

const produto = { id: 'p1', nome: 'Shockwatch', status: 'Ativo', complexidade: 'Baixa' }

describe('motor de qualificação', () => {
  it('sem produto de interesse → pendente', () => {
    const r = qualificar(lead(), null)
    expect(r.status).toBe('pendente')
    expect(r.pendencias).toContain('Produto de interesse não selecionado')
  })

  it('produto inativo → pendente', () => {
    expect(qualificar(lead(), { ...produto, status: 'Inativo' }).status).toBe('pendente')
  })

  it('produto de alta complexidade → fora do recorte', () => {
    expect(qualificar(lead(), { ...produto, complexidade: 'Alta' }).status).toBe('fora do recorte')
  })

  // lição AP-2026-11-10-2149: o texto vem como o usuário digita (com ç e ã)
  it('dor com sinal técnico acentuado ("integração") → transbordo', () => {
    const r = qualificar(lead({ dor: 'Precisamos de integração com o ERP' }), produto)
    expect(r.status).toBe('transbordo')
  })

  it('dor com sinal técnico sem acento → transbordo', () => {
    expect(qualificar(lead({ dor: 'automacao da expedicao' }), produto).status).toBe('transbordo')
  })

  it('produto ativo + dor + urgência → qualificado', () => {
    const r = qualificar(lead(), produto)
    expect(r.status).toBe('qualificado')
    expect(r.pendencias).toHaveLength(0)
  })

  it('falta dor → pendente com a pendência listada', () => {
    const r = qualificar(lead({ dor: '' }), produto)
    expect(r.status).toBe('pendente')
    expect(r.pendencias).toContain('Dor / necessidade não informada')
  })

  it('falta urgência → pendente com a pendência listada', () => {
    const r = qualificar(lead({ urgencia: '' }), produto)
    expect(r.status).toBe('pendente')
    expect(r.pendencias).toContain('Urgência não informada')
  })

  // F2-T01: a área de interesse sugere famílias de diagnóstico (sugestão, não bloqueio)
  it('área de interesse sugere famílias candidatas', () => {
    expect(familiasPorArea('Cadeia do Frio')).toEqual(['2'])
    expect(familiasPorArea('Segurança e Logística')).toEqual(['4', '4a', '5'])
    expect(familiasPorArea('Qualidade no Transporte')).toEqual(['1', '3', '6', '7'])
    expect(familiasPorArea('')).toEqual([])
    expect(sugestaoFamilias('Segurança e Logística')).toBe(
      'Área de interesse Segurança e Logística — famílias de diagnóstico sugeridas: 4, 4a e 5',
    )
    expect(sugestaoFamilias('Cadeia do Frio')).toBe(
      'Área de interesse Cadeia do Frio — família de diagnóstico sugerida: 2',
    )
  })

  it('sugestão entra na justificativa sem mudar o status', () => {
    const r = qualificar(lead({ area_interesse: 'Cadeia do Frio' }), produto)
    expect(r.status).toBe('qualificado')
    expect(justificativa(r)).toContain('família de diagnóstico sugerida: 2.')
  })

  it('sem área de interesse a justificativa não muda', () => {
    expect(qualificar(lead(), produto).motivos.join(' ')).not.toContain('família')
  })

  it('justificativa sem códigos internos e com pontuação final', () => {
    const texto = justificativa(qualificar(lead(), produto))
    expect(texto).not.toMatch(/RN-|SPEC|F1-T/)
    expect(texto.endsWith('.')).toBe(true)
  })
})
