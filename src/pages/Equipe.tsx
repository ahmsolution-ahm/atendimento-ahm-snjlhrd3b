import React, { useCallback, useEffect, useState } from 'react'
import { usersService, rotuloPapel } from '@/services/users'
import type { PapelUsuario, UserRecord } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { UserPlus, Mail, ShieldCheck, RefreshCw, Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

// Fase 2 · Bloco 3 (F2-T11): gestão da equipe — só administrador (rota e servidor restringem).
// Papéis: Administrador (tudo, inclusive exclusões, catálogo, demonstração e usuários) e
// Vendedor (operação do dia a dia de leads, oportunidades, transbordos e métricas).

const mensagemErro = (err: unknown, padrao: string): string => {
  const e = err as { response?: { message?: string; data?: Record<string, { message?: string }> } }
  const campos = e?.response?.data ? Object.values(e.response.data) : []
  const primeiro = campos.find((c) => c?.message)?.message
  return primeiro || e?.response?.message || padrao
}

const PAPEIS: { valor: PapelUsuario; descricao: string }[] = [
  {
    valor: 'vendedor',
    descricao: 'Opera leads, oportunidades, transbordos, interações, checklist e métricas.',
  },
  {
    valor: 'admin',
    descricao:
      'Tudo do vendedor, mais exclusões, catálogo de produtos, demonstração e gestão da equipe.',
  },
]

export default function Equipe() {
  const { toast } = useToast()
  const { user } = useAuth()
  const [usuarios, setUsuarios] = useState<UserRecord[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvandoId, setSalvandoId] = useState<string | null>(null)

  const [cadastroAberto, setCadastroAberto] = useState(false)
  const [form, setForm] = useState({
    nome: '',
    email: '',
    senha: '',
    papel: 'vendedor' as PapelUsuario,
  })
  const [cadastrando, setCadastrando] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      setUsuarios(await usersService.list())
    } catch {
      toast({
        title: 'Erro ao carregar a equipe',
        description: 'Não foi possível listar os usuários. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }, [toast])

  useEffect(() => {
    carregar()
  }, [carregar])

  const alterarPapel = async (membro: UserRecord, papel: PapelUsuario) => {
    if ((membro.papel || 'vendedor') === papel) return
    const nome = membro.name || membro.email
    if (
      !window.confirm(
        `Alterar o papel de ${nome} para ${rotuloPapel(papel)}? A mudança vale a partir da próxima ação dessa pessoa no sistema.`,
      )
    )
      return
    setSalvandoId(membro.id)
    try {
      const atualizado = await usersService.alterarPapel(membro.id, papel)
      setUsuarios((prev) => prev.map((u) => (u.id === membro.id ? { ...u, ...atualizado } : u)))
      toast({ title: 'Papel atualizado', description: `${nome} agora é ${rotuloPapel(papel)}.` })
    } catch (err) {
      toast({
        title: 'Não foi possível alterar o papel',
        description: mensagemErro(err, 'Ocorreu uma falha inesperada. Tente novamente.'),
        variant: 'destructive',
      })
    } finally {
      setSalvandoId(null)
    }
  }

  const cadastrar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.senha.length < 8) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha inicial deve ter ao menos 8 caracteres.',
        variant: 'destructive',
      })
      return
    }
    setCadastrando(true)
    try {
      await usersService.cadastrar(form)
      toast({
        title: 'Usuário cadastrado',
        description: `${form.nome || form.email} já pode entrar com o e-mail e a senha inicial informados.`,
      })
      setCadastroAberto(false)
      setForm({ nome: '', email: '', senha: '', papel: 'vendedor' })
      await carregar()
    } catch (err) {
      toast({
        title: 'Não foi possível cadastrar o usuário',
        description: mensagemErro(err, 'Verifique os dados e tente novamente.'),
        variant: 'destructive',
      })
    } finally {
      setCadastrando(false)
    }
  }

  const inputCls =
    'w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] bg-white outline-none focus:border-[#DE6464]'
  const labelCls = 'block text-xs font-semibold text-[#030507] mb-1'

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#DE6464] mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gestão da equipe</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#030507]">Equipe e permissões</h1>
          <p className="text-xs text-[#6B7280]">
            Usuários com acesso à plataforma e o papel de cada um.
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={carregar}
            className="px-3 py-2.5 rounded-xl text-xs font-semibold text-[#030507] bg-white border border-[#E5E7EB] shadow-sm hover:bg-[#FAF7F2] flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <button
            type="button"
            onClick={() => setCadastroAberto(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white shadow-md hover:bg-[#C94F4F] flex items-center gap-2"
            style={{ backgroundColor: '#DE6464' }}
          >
            <UserPlus className="w-4 h-4" />
            Cadastrar usuário
          </button>
        </div>
      </div>

      {/* Legenda dos papéis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PAPEIS.map((p) => (
          <div key={p.valor} className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
            <p className="text-xs font-bold text-[#030507] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#DE6464]" />
              {rotuloPapel(p.valor)}
            </p>
            <p className="text-[11px] text-[#6B7280] mt-1">{p.descricao}</p>
          </div>
        ))}
      </div>

      {/* Lista */}
      {carregando ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 text-[#DE6464] animate-spin" />
        </div>
      ) : usuarios.length === 0 ? (
        <p className="text-xs text-[#6B7280] bg-white rounded-2xl border border-[#E5E7EB] p-6 text-center">
          Nenhum usuário encontrado.
        </p>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm divide-y divide-[#F3F4F6]">
          {usuarios.map((m) => {
            const papel = (m.papel || 'vendedor') as PapelUsuario
            const ehVoce = m.id === user?.id
            return (
              <div
                key={m.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-white shrink-0"
                    style={{ backgroundColor: papel === 'admin' ? '#030507' : '#DE6464' }}
                  >
                    {(m.name || m.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#030507] truncate">
                      {m.name || 'Sem nome cadastrado'}
                      {ehVoce && (
                        <span className="ml-2 text-[10px] font-semibold text-[#6B7280]">
                          (você)
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-[#6B7280] flex items-center gap-1 truncate">
                      <Mail className="w-3 h-3 text-[#9CA3AF]" />
                      {m.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <label htmlFor={`papel-${m.id}`} className="text-[11px] text-[#6B7280]">
                    Papel
                  </label>
                  <select
                    id={`papel-${m.id}`}
                    value={papel}
                    disabled={salvandoId === m.id}
                    onChange={(e) => alterarPapel(m, e.target.value as PapelUsuario)}
                    className="px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] bg-white outline-none focus:border-[#DE6464] disabled:opacity-50"
                  >
                    <option value="vendedor">Vendedor</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Cadastro de usuário */}
      <Dialog open={cadastroAberto} onOpenChange={setCadastroAberto}>
        <DialogContent className="max-w-md bg-white p-6 rounded-2xl modal-ahm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#030507]">
              Cadastrar usuário
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B7280]">
              Crie o acesso com uma senha inicial e informe-a à pessoa por um canal seguro.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={cadastrar} className="space-y-4 mt-2">
            <div>
              <label className={labelCls} htmlFor="cad-nome">
                Nome
              </label>
              <input
                id="cad-nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="cad-email">
                E-mail corporativo
              </label>
              <input
                id="cad-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="cad-senha">
                Senha inicial (mínimo de 8 caracteres)
              </label>
              <input
                id="cad-senha"
                type="password"
                autoComplete="new-password"
                value={form.senha}
                onChange={(e) => setForm({ ...form, senha: e.target.value })}
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="cad-papel">
                Papel
              </label>
              <select
                id="cad-papel"
                value={form.papel}
                onChange={(e) => setForm({ ...form, papel: e.target.value as PapelUsuario })}
                className={inputCls}
              >
                <option value="vendedor">Vendedor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCadastroAberto(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[#6B7280]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={cadastrando}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-md disabled:opacity-50"
                style={{ backgroundColor: '#DE6464' }}
              >
                {cadastrando ? 'Cadastrando…' : 'Cadastrar'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
