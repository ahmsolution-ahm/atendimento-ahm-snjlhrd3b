import pb from '@/lib/pocketbase/client'
import type { ProdutoRecord } from '@/types'

export const produtosService = {
  async list(filter?: string, sort: string = 'nome'): Promise<ProdutoRecord[]> {
    return await pb.collection('produtos').getFullList<ProdutoRecord>({
      filter,
      sort,
      expand: 'especialista',
    })
  },

  async getById(id: string): Promise<ProdutoRecord> {
    return await pb.collection('produtos').getOne<ProdutoRecord>(id, {
      expand: 'especialista',
    })
  },

  async create(data: ProdutoInput): Promise<ProdutoRecord> {
    return await pb.collection('produtos').create<ProdutoRecord>(data, {
      expand: 'especialista',
    })
  },

  async update(id: string, data: Partial<ProdutoInput>): Promise<ProdutoRecord> {
    return await pb.collection('produtos').update<ProdutoRecord>(id, data, {
      expand: 'especialista',
    })
  },

  async listAtivos(): Promise<ProdutoRecord[]> {
    const all = await this.list()
    return all.filter((p) => p.status === 'Ativo' && p.incompleto !== true)
  },
}

export interface ProdutoInput {
  nome: string
  familia?: string
  tipo_venda: 'Recorrente' | 'Pontual'
  icp: string
  dor: string
  escopo: string
  perguntas: string
  faq?: string
  timing?: string
  complexidade: 'Baixa' | 'Alta'
  especialista?: string
  status: 'Ativo' | 'Inativo'
  incompleto?: boolean
}
