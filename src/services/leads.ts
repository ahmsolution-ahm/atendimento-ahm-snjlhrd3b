import pb from '@/lib/pocketbase/client'
import type { LeadRecord } from '@/types'
import type { CsvLeadRow, LinhaInvalida } from '@/lib/csvImport'

export interface ImportPreview {
  total: number
  validas: CsvLeadRow[]
  invalidas: LinhaInvalida[]
  duplicadasNoArquivo: CsvLeadRow[]
  duplicadasNaBase: CsvLeadRow[]
  cabecalhos: string[]
}

export const leadsService = {
  async list(filter?: string, sort: string = '-created'): Promise<LeadRecord[]> {
    return await pb.collection('leads').getFullList<LeadRecord>({
      filter,
      sort,
      expand: 'produto_interesse,responsavel',
    })
  },

  async getById(id: string): Promise<LeadRecord> {
    return await pb.collection('leads').getOne<LeadRecord>(id, {
      expand: 'produto_interesse,responsavel',
    })
  },

  async create(data: LeadInput): Promise<LeadRecord> {
    return await pb.collection('leads').create<LeadRecord>(data, {
      expand: 'produto_interesse,responsavel',
    })
  },

  async update(id: string, data: Partial<LeadInput>): Promise<LeadRecord> {
    return await pb.collection('leads').update<LeadRecord>(id, data, {
      expand: 'produto_interesse,responsavel',
    })
  },

  // F1-T07/F1-T08: gravar o resultado do motor de qualificação com histórico de reprocessamento.
  // O histórico é montado AQUI (frontend): lê o resultado anterior, anexa {em, por, status, resultado}
  // e envia o array no PATCH — a API do PocketBase aceita array direto em campo json
  // (o hook backend não consegue: r.set com array dá invalid_json, com string dá charcodes).
  async gravarQualificacao(
    id: string,
    resultado: { status: string; motivos: string[]; pendencias: string[] },
    justificativa: string,
    qualificadoPor?: string,
    leadAtual?: LeadRecord,
  ): Promise<LeadRecord> {
    // montar histórico: resultado anterior (se existir e for diferente) vai para o topo
    let historico: { em: string; por: string; status: string; resultado: string }[] = []
    const anterior = leadAtual?.qualificacao_historico
    if (anterior) {
      try {
        const parsed = typeof anterior === 'string' ? JSON.parse(anterior) : anterior
        if (Array.isArray(parsed)) historico = parsed
      } catch (_) {
        historico = []
      }
    }
    const resultadoAnterior = leadAtual?.qualificacao_resultado || ''
    if (resultadoAnterior && resultadoAnterior !== justificativa) {
      historico.unshift({
        em: leadAtual?.qualificado_em || leadAtual?.updated || '',
        por: leadAtual?.qualificado_por || '',
        status: leadAtual?.status || '',
        resultado: resultadoAnterior,
      })
      if (historico.length > 20) historico = historico.slice(0, 20)
    }
    return await pb.collection('leads').update<LeadRecord>(
      id,
      {
        status: resultado.status as LeadInput['status'],
        qualificacao_resultado: justificativa,
        qualificacao_pendencias: resultado.pendencias,
        qualificado_por: resultado.status === 'qualificado' ? qualificadoPor : undefined,
        qualificado_em: resultado.status === 'qualificado' ? new Date().toISOString() : '',
        qualificacao_historico: historico,
      },
      {
        expand: 'produto_interesse,responsavel',
      },
    )
  },

  // F1-T08: reprocessar a qualificação após edição do lead (histórico montado em gravarQualificacao)
  async requalificar(
    id: string,
    resultado: { status: string; motivos: string[]; pendencias: string[] },
    justificativa: string,
    qualificadoPor?: string,
    leadAtual?: LeadRecord,
  ): Promise<LeadRecord> {
    return await this.gravarQualificacao(id, resultado, justificativa, qualificadoPor, leadAtual)
  },

  // F1-T08: rollback auditável — voltar para pendente exige motivo (SPEC 1.3)
  // O resultado anterior vai para o histórico (montado aqui, mesmo mecanismo da qualificação).
  async voltarPendente(
    id: string,
    motivo: string,
    usuario?: string,
    leadAtual?: LeadRecord,
  ): Promise<LeadRecord> {
    const just = `rollback para pendente — motivo: ${motivo} (registrado por ${usuario || 'usuário'})`
    let historico: { em: string; por: string; status: string; resultado: string }[] = []
    const anterior = leadAtual?.qualificacao_historico
    if (anterior) {
      try {
        const parsed = typeof anterior === 'string' ? JSON.parse(anterior) : anterior
        if (Array.isArray(parsed)) historico = parsed
      } catch (_) {
        historico = []
      }
    }
    const resultadoAnterior = leadAtual?.qualificacao_resultado || ''
    if (resultadoAnterior && resultadoAnterior !== just) {
      historico.unshift({
        em: leadAtual?.qualificado_em || leadAtual?.updated || '',
        por: leadAtual?.qualificado_por || '',
        status: leadAtual?.status || '',
        resultado: resultadoAnterior,
      })
      if (historico.length > 20) historico = historico.slice(0, 20)
    }
    return await pb.collection('leads').update<LeadRecord>(
      id,
      {
        status: 'pendente',
        qualificacao_resultado: just,
        qualificacao_pendencias: [`rollback solicitado: ${motivo}`],
        qualificado_em: '',
        qualificado_por: '',
        qualificacao_historico: historico,
      },
      {
        expand: 'produto_interesse,responsavel',
      },
    )
  },

  // F1-T06 RN-1.5: consultar duplicidade local por contato+empresa (case-insensitive).  // Retorna os leads existentes com a mesma chave — usado no formulário manual para avisar
  // ANTES de confirmar. Não bloqueia: o usuário decide (RN-1.5).
  async buscarDuplicidade(contato: string, empresa: string): Promise<LeadRecord[]> {
    const c = (contato || '').trim()
    const e = (empresa || '').trim()
    if (!c || !e) return []
    const filtro =
      `((contato~'${c.replace(/'/g, "\\'")}' || contato~'${c.split('@')[0].replace(/'/g, "\\'")}') && ` +
      `empresa~'${e.replace(/'/g, "\\'")}')`
    try {
      return await pb.collection('leads').getFullList<LeadRecord>({
        filter: filtro,
        sort: '-created',
        expand: 'produto_interesse',
      })
    } catch (_) {
      return []
    }
  },

  // F1-T05: importação em lote — cria as linhas válidas uma a uma e reporta falhas por linha.
  // RN-1.4: linha sem nome+empresa+contato vai como rascunho (incompleto=true); RN-1.6 aplica pendente via hook.
  async importarLote(
    linhas: CsvLeadRow[],
    produtoPorNome: Map<string, string>,
    responsavel: string,
    onProgress?: (done: number, total: number) => void,
  ): Promise<{ criados: number; falhas: LinhaInvalida[] }> {
    const criados: number[] = []
    const falhas: LinhaInvalida[] = []
    let done = 0
    for (const l of linhas) {
      try {
        const produtoId = l.produto_interesse
          ? produtoPorNome.get(l.produto_interesse.trim().toLowerCase())
          : undefined
        const completo = !!(l.nome && l.empresa && l.contato)
        await pb.collection('leads').create({
          nome: l.nome || '',
          empresa: l.empresa || '',
          contato: l.contato || '',
          origem: l.origem || 'Importação CSV',
          produto_interesse: produtoId,
          dor: l.dor,
          urgencia: l.urgencia,
          observacoes:
            [
              l.cargo ? `Cargo: ${l.cargo}` : '',
              l.telefone ? `Tel: ${l.telefone}` : '',
              l.celular ? `Cel: ${l.celular}` : '',
            ]
              .filter(Boolean)
              .join(' · ') || undefined,
          responsavel,
          status: completo ? 'novo' : 'pendente',
          incompleto: !completo,
        })
        criados.push(l.linha)
      } catch (err) {
        const msg =
          typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: string }).message)
            : 'erro desconhecido'
        falhas.push({ linha: l.linha, motivo: msg, dados: [l.nome, l.empresa, l.contato] })
      }
      done++
      if (onProgress && done % 50 === 0) onProgress(done, linhas.length)
    }
    if (onProgress) onProgress(linhas.length, linhas.length)
    return { criados: criados.length, falhas }
  },
}

export interface LeadInput {
  nome: string
  empresa: string
  contato: string
  origem?: string
  produto_interesse?: string
  dor?: string
  urgencia?: 'Baixa' | 'Média' | 'Alta'
  observacoes?: string
  responsavel?: string
  status: 'novo' | 'em qualificação' | 'qualificado' | 'pendente' | 'fora do recorte' | 'transbordo'
  incompleto?: boolean
  qualificacao_resultado?: string
  qualificacao_pendencias?: string[]
  qualificado_em?: string
  qualificado_por?: string
  qualificacao_historico?: string
}
