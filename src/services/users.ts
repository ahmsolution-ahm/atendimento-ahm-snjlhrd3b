import pb from '@/lib/pocketbase/client'
import type { PapelUsuario, UserRecord } from '@/types'

// Fase 2 · Bloco 3: gestão de usuários (só administrador — o servidor recusa os demais).
// Coleção pequena (equipe interna), então a listagem única é aceitável aqui.
export const usersService = {
  async list(): Promise<UserRecord[]> {
    const r = await pb.collection('users').getList<UserRecord>(1, 200, { sort: 'name,email' })
    return r.items
  },

  async alterarPapel(id: string, papel: PapelUsuario): Promise<UserRecord> {
    return await pb.collection('users').update<UserRecord>(id, { papel })
  },

  async cadastrar(dados: {
    nome: string
    email: string
    senha: string
    papel: PapelUsuario
  }): Promise<UserRecord> {
    return await pb.collection('users').create<UserRecord>({
      name: dados.nome.trim(),
      email: dados.email.trim().toLowerCase(),
      emailVisibility: true,
      password: dados.senha,
      passwordConfirm: dados.senha,
      papel: dados.papel,
    })
  },
}

export const rotuloPapel = (papel?: string): string =>
  papel === 'admin' ? 'Administrador' : 'Vendedor'
