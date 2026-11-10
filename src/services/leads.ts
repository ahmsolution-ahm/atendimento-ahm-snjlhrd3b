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
}
