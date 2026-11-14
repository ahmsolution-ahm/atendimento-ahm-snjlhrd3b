// IA de vendas · F0.3 — horários que podem ser oferecidos ao cliente.
// Regra (owner + Bart): horário oferecido = janela PREFERIDA do executivo ∩ horário LIVRE na
// agenda real (Outlook). Sem agenda (não conectada, falhou, inválida) → NENHUM horário, com
// erro sinalizado — nunca um horário inventado.
// GÊMEA: a mesma lógica está copiada dentro do hook pocketbase/hooks/ia_fundacao.js (o JSVM do
// Skip não aceita require de arquivo local). Qualquer mudança aqui deve ser replicada lá.

export interface Janela {
  dia_semana: number // 0 = domingo … 6 = sábado (horário local)
  inicio: string // "HH:MM" local
  fim: string // "HH:MM" local
  ativo?: boolean
}

export interface Ocupado {
  inicio: string // ISO
  fim: string // ISO
}

export interface OpcoesHorarios {
  janelas: Janela[]
  agenda: Ocupado[] | null | undefined // null/undefined = agenda indisponível
  agoraMs?: number
  fusoMin?: number // deslocamento do horário local em relação a UTC (Brasília = -180)
  duracaoMin?: number
  maximo?: number
  dias?: number
  antecedenciaHoras?: number
}

export type ErroHorarios =
  | 'agenda_indisponivel'
  | 'agenda_invalida'
  | 'sem_janelas'
  | 'sem_horario_livre'

export interface ResultadoHorarios {
  horarios: { inicio: string; fim: string }[]
  erro: ErroHorarios | null
}

const minutos = (hhmm: string): number | null => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(hhmm || ''))
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

export function horariosDisponiveis(o: OpcoesHorarios): ResultadoHorarios {
  if (!Array.isArray(o.agenda)) return { horarios: [], erro: 'agenda_indisponivel' }
  const ocupados: [number, number][] = []
  for (const b of o.agenda) {
    const a = Date.parse(b?.inicio)
    const f = Date.parse(b?.fim)
    if (!Number.isFinite(a) || !Number.isFinite(f) || f <= a)
      return { horarios: [], erro: 'agenda_invalida' }
    ocupados.push([a, f])
  }
  const janelas = (o.janelas || []).filter(
    (j) =>
      j &&
      j.ativo !== false &&
      Number.isInteger(j.dia_semana) &&
      j.dia_semana >= 0 &&
      j.dia_semana <= 6 &&
      minutos(j.inicio) !== null &&
      minutos(j.fim) !== null &&
      (minutos(j.inicio) as number) < (minutos(j.fim) as number),
  )
  if (janelas.length === 0) return { horarios: [], erro: 'sem_janelas' }

  const agora = o.agoraMs ?? Date.now()
  const fuso = o.fusoMin ?? -180
  const duracao = o.duracaoMin ?? 30
  const maximo = o.maximo ?? 3
  const dias = o.dias ?? 10
  const limite = agora + (o.antecedenciaHoras ?? 24) * 3600e3
  const horarios: { inicio: string; fim: string }[] = []

  for (let d = 0; d <= dias && horarios.length < maximo; d++) {
    const local = new Date(agora + fuso * 60e3 + d * 86400e3)
    const ano = local.getUTCFullYear()
    const mes = local.getUTCMonth()
    const dia = local.getUTCDate()
    const semana = local.getUTCDay()
    const doDia = janelas
      .filter((j) => j.dia_semana === semana)
      .sort((a, b) => (minutos(a.inicio) as number) - (minutos(b.inicio) as number))
    let achou = false
    for (const j of doDia) {
      if (achou) break
      const ini = minutos(j.inicio) as number
      const fim = minutos(j.fim) as number
      for (let t = ini; t + duracao <= fim; t += 30) {
        const inicioMs = Date.UTC(ano, mes, dia, Math.floor(t / 60), t % 60) - fuso * 60e3
        const fimMs = inicioMs + duracao * 60e3
        if (inicioMs < limite) continue
        if (ocupados.some(([a, f]) => inicioMs < f && fimMs > a)) continue
        horarios.push({
          inicio: new Date(inicioMs).toISOString(),
          fim: new Date(fimMs).toISOString(),
        })
        achou = true // no máximo um horário por dia, para dar opções em dias diferentes
        break
      }
    }
  }
  return { horarios, erro: horarios.length > 0 ? null : 'sem_horario_livre' }
}
