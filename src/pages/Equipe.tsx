import React, { useState, useEffect } from 'react'
import { usersService } from '@/services/users'
import type { UserRecord } from '@/types'
import { useToast } from '@/hooks/use-toast'
import { UserPlus, Mail, ShieldCheck, Star, CheckCircle2, Clock, Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface MemberExtraData {
  cargo: string
  isOnline: boolean
  ticketsResolvidos: number
  tempoMedio: string
  rating: number
  avatarSeed: number
}

export default function Equipe() {
  const { toast } = useToast()
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Modal de Convite
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteCargo, setInviteCargo] = useState('Consultor Comercial')
  const [isInviting, setIsInviting] = useState(false)

  // Mapeamento visual enriquecido para a equipe da AHM Solution
  const teamMetadata: Record<string, MemberExtraData> = {
    'afonso.moreira@ahmsolution.com': {
      cargo: 'Coordenador Comercial & Contas Chave',
      isOnline: true,
      ticketsResolvidos: 48,
      tempoMedio: '14 min',
      rating: 4.9,
      avatarSeed: 12,
    },
    'beatriz.silva@ahmsolution.com': {
      cargo: 'Especialista em Logística e Fretes',
      isOnline: true,
      ticketsResolvidos: 35,
      tempoMedio: '16 min',
      rating: 4.8,
      avatarSeed: 24,
    },
    'carlos.mendes@ahmsolution.com': {
      cargo: 'Consultor de Armazenagem & Contratos',
      isOnline: false,
      ticketsResolvidos: 29,
      tempoMedio: '22 min',
      rating: 4.7,
      avatarSeed: 45,
    },
    'mariana.costa@ahmsolution.com': {
      cargo: 'Analista de Suporte e Integrações',
      isOnline: true,
      ticketsResolvidos: 41,
      tempoMedio: '12 min',
      rating: 5.0,
      avatarSeed: 88,
    },
  }

  useEffect(() => {
    usersService
      .list()
      .then((data) => setUsers(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail) return

    setIsInviting(true)
    setTimeout(() => {
      setIsInviting(false)
      setIsInviteOpen(false)
      toast({
        title: 'Convite enviado!',
        description: `Link de acesso enviado para ${inviteEmail} com cargo "${inviteCargo}".`,
      })
      setInviteEmail('')
    }, 800)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#DE6464] mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gestão de Colaboradores</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[#030507]">Equipe Comercial & Suporte</h1>
          <p className="text-xs text-[#6B7280]">
            Membros cadastrados, disponibilidade em tempo real e indicadores de desempenho
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsInviteOpen(true)}
          className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white shadow-md transition-all hover:bg-[#C94F4F] flex items-center gap-2 self-start sm:self-auto"
          style={{ backgroundColor: '#DE6464' }}
        >
          <UserPlus className="w-4 h-4" />
          <span>Convidar membro</span>
        </button>
      </div>

      {/* Grid de Cards da Equipe */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {users.map((member) => {
          const meta = teamMetadata[member.email] || {
            cargo: 'Consultor Comercial',
            isOnline: false,
            ticketsResolvidos: 18,
            tempoMedio: '20 min',
            rating: 4.8,
            avatarSeed: 99,
          }

          return (
            <div
              key={member.id}
              className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between relative overflow-hidden group"
            >
              {/* Indicador de Status Online/Offline */}
              <div className="flex items-center justify-between mb-4">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                    meta.isOnline
                      ? 'bg-emerald-50 text-[#10B981] border-emerald-200'
                      : 'bg-gray-100 text-[#6B7280] border-gray-200'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      meta.isOnline ? 'bg-[#10B981]' : 'bg-[#9CA3AF]'
                    }`}
                  />
                  {meta.isOnline ? 'Online' : 'Offline'}
                </span>

                <div className="flex items-center gap-1 text-[11px] font-bold text-[#E5BE94]">
                  <Star className="w-3.5 h-3.5 fill-[#E5BE94] text-[#E5BE94]" />
                  <span>{meta.rating.toFixed(1)}</span>
                </div>
              </div>

              {/* Avatar + Nome + Email */}
              <div className="flex flex-col items-center text-center mb-5">
                <div className="relative mb-3">
                  <img
                    src={`https://img.usecurling.com/ppl/128?seed=${meta.avatarSeed}`}
                    alt={member.name || 'Membro AHM'}
                    className="w-16 h-16 rounded-2xl object-cover shadow-sm border-2 border-white ring-2 ring-[#DE6464]/20"
                  />
                  {meta.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#10B981] ring-2 ring-white" />
                  )}
                </div>

                <h2 className="text-sm font-bold text-[#030507]">
                  {member.name || 'Colaborador AHM'}
                </h2>
                <span className="text-[11px] font-medium text-[#DE6464] mt-0.5">{meta.cargo}</span>

                <div className="flex items-center gap-1 text-[11px] text-[#6B7280] mt-2">
                  <Mail className="w-3 h-3 text-[#9CA3AF]" />
                  <span className="truncate max-w-[190px]">{member.email}</span>
                </div>
              </div>

              {/* Métricas Individuais */}
              <div className="grid grid-cols-2 gap-2 pt-4 border-t border-[#E5E7EB] text-center">
                <div className="p-2 rounded-xl bg-[#FAF7F2]">
                  <span className="text-[10px] text-[#6B7280] block font-medium">Resolvidos</span>
                  <span className="text-xs font-bold text-[#030507] flex items-center justify-center gap-1 mt-0.5">
                    <CheckCircle2 className="w-3 h-3 text-[#10B981]" />
                    {meta.ticketsResolvidos}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-[#FAF7F2]">
                  <span className="text-[10px] text-[#6B7280] block font-medium">Tempo Médio</span>
                  <span className="text-xs font-bold text-[#030507] flex items-center justify-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-[#E5BE94]" />
                    {meta.tempoMedio}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal Convidar Membro */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="max-w-md bg-white p-6 rounded-2xl modal-ahm">
          <DialogHeader>
            <div className="w-10 h-10 rounded-xl bg-[#DE6464]/10 text-[#DE6464] flex items-center justify-center mb-2">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-[#030507]">
              Convidar Novo Membro da Equipe
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B7280]">
              Envie um convite seguro para ingresso na plataforma comercial da AHM Solution.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSendInvite} className="space-y-4 mt-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1">
                Email Corporativo *
              </label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colaborador@ahmsolution.com.br"
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] outline-none focus:border-[#DE6464]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1">
                Cargo / Função *
              </label>
              <select
                value={inviteCargo}
                onChange={(e) => setInviteCargo(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] bg-white outline-none focus:border-[#DE6464]"
              >
                <option value="Consultor Comercial">Consultor Comercial</option>
                <option value="Especialista em Logística e Fretes">
                  Especialista em Logística e Fretes
                </option>
                <option value="Analista de Suporte ao Cliente">
                  Analista de Suporte ao Cliente
                </option>
                <option value="Supervisor de Operações">Supervisor de Operações</option>
                <option value="Gerente de Contas">Gerente de Contas</option>
              </select>
            </div>

            <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E5E7EB] text-[11px] text-[#6B7280]">
              O colaborador receberá um email com instruções para criação da credencial de acesso
              com permissões padrão da equipe comercial.
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsInviteOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[#6B7280]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isInviting || !inviteEmail}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-md disabled:opacity-50"
                style={{ backgroundColor: '#DE6464' }}
              >
                {isInviting ? 'Enviando convite...' : 'Enviar Convite'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
