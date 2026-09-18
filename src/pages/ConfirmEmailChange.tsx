import React, { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from '@/components/Logo'
import { CheckCircle2, AlertCircle, Loader2, Lock, ArrowLeft } from 'lucide-react'

export default function ConfirmEmailChange() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const { confirmEmailChange } = useAuth()

  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      setStatus('error')
      setErrorMessage('Token de confirmação ausente ou link expirado.')
      return
    }

    setStatus('loading')
    try {
      await confirmEmailChange(token, password)
      setStatus('success')
    } catch (err: unknown) {
      setStatus('error')
      setErrorMessage(
        err instanceof Error ? err.message : 'Falha ao confirmar a alteração do email.',
      )
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#FAF7F2]">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#E5E7EB] p-8 text-center">
        <div className="flex justify-center mb-6">
          <Logo variant="dark" size="md" />
        </div>

        {status === 'success' ? (
          <div className="space-y-4 py-2">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-[#10B981] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold text-[#030507]">Email alterado com sucesso</h1>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              O seu novo email corporativo foi validado. Por motivos de conformidade e segurança da
              rede AHM, faça login novamente utilizando seu novo endereço e senha.
            </p>
            <div className="pt-4">
              <Link
                to="/login"
                className="inline-block w-full py-3 px-4 rounded-xl text-xs font-semibold text-white shadow"
                style={{ backgroundColor: '#DE6464' }}
              >
                Ir para o login
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-xl font-bold text-[#030507] mb-2">Confirmar alteração de email</h1>
            <p className="text-xs text-[#6B7280] mb-6">
              Digite sua senha corporativa atual para homologar a troca do seu endereço eletrônico.
            </p>

            {status === 'error' && (
              <div className="p-3.5 mb-4 rounded-xl bg-red-50 border border-red-200 text-[#DC2626] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div>
                <label
                  htmlFor="confirm-pass"
                  className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1.5"
                >
                  Senha atual
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9CA3AF]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="confirm-pass"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha atual"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#030507] bg-white outline-none focus:border-[#DE6464] focus:ring-2 focus:ring-[#DE6464]/20"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full py-3 px-4 rounded-xl font-semibold text-xs text-white shadow-md transition-all duration-150 flex items-center justify-center gap-2 hover:bg-[#D45555] disabled:opacity-60"
                style={{ backgroundColor: '#DE6464' }}
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Confirmando alteração...</span>
                  </>
                ) : (
                  <span>Homologar novo email</span>
                )}
              </button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B7280] hover:text-[#030507]"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar para o login
                </Link>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
