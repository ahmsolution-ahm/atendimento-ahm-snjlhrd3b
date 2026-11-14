import { describe, expect, it } from 'vitest'
import { horariosDisponiveis, type Janela } from './horarios'

// segunda-feira 16/11/2026 08:00 em Brasília = 11:00 UTC
const AGORA = Date.UTC(2026, 10, 16, 11, 0)
const JANELAS: Janela[] = [
  { dia_semana: 2, inicio: '10:00', fim: '12:00' }, // terça
  { dia_semana: 3, inicio: '14:00', fim: '16:00' }, // quarta
  { dia_semana: 4, inicio: '09:00', fim: '10:00' }, // quinta
]

describe('horários disponíveis (janelas ∩ agenda real)', () => {
  it('agenda indisponível → nenhum horário, com erro (nunca inventa)', () => {
    expect(horariosDisponiveis({ janelas: JANELAS, agenda: null, agoraMs: AGORA })).toEqual({
      horarios: [],
      erro: 'agenda_indisponivel',
    })
    expect(horariosDisponiveis({ janelas: JANELAS, agenda: undefined, agoraMs: AGORA }).erro).toBe(
      'agenda_indisponivel',
    )
  })

  it('agenda com item inválido → nenhum horário', () => {
    const r = horariosDisponiveis({
      janelas: JANELAS,
      agenda: [{ inicio: 'x', fim: 'y' }],
      agoraMs: AGORA,
    })
    expect(r).toEqual({ horarios: [], erro: 'agenda_invalida' })
  })

  it('sem janelas ativas → erro sem_janelas', () => {
    const r = horariosDisponiveis({
      janelas: [{ ...JANELAS[0], ativo: false }],
      agenda: [],
      agoraMs: AGORA,
    })
    expect(r.erro).toBe('sem_janelas')
  })

  it('agenda livre → 3 horários em dias diferentes, no início de cada janela (horário de Brasília)', () => {
    const r = horariosDisponiveis({ janelas: JANELAS, agenda: [], agoraMs: AGORA })
    expect(r.erro).toBeNull()
    expect(r.horarios.map((h) => h.inicio)).toEqual([
      '2026-11-17T13:00:00.000Z', // terça 10:00 BRT
      '2026-11-18T17:00:00.000Z', // quarta 14:00 BRT
      '2026-11-19T12:00:00.000Z', // quinta 09:00 BRT
    ])
  })

  it('compromisso no Outlook empurra o horário ou elimina o dia', () => {
    const r = horariosDisponiveis({
      janelas: JANELAS,
      agenda: [
        { inicio: '2026-11-17T13:00:00.000Z', fim: '2026-11-17T14:00:00.000Z' }, // terça 10–11 ocupada
        { inicio: '2026-11-19T12:00:00.000Z', fim: '2026-11-19T13:00:00.000Z' }, // quinta inteira ocupada
      ],
      agoraMs: AGORA,
      dias: 4,
    })
    expect(r.horarios.map((h) => h.inicio)).toEqual([
      '2026-11-17T14:00:00.000Z',
      '2026-11-18T17:00:00.000Z',
    ])
  })

  it('respeita a antecedência mínima (não oferece horário em menos de 24 h)', () => {
    const r = horariosDisponiveis({
      janelas: [{ dia_semana: 1, inicio: '09:00', fim: '18:00' }],
      agenda: [],
      agoraMs: AGORA,
      dias: 1,
    })
    expect(r).toEqual({ horarios: [], erro: 'sem_horario_livre' })
  })
})
