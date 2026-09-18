import React, { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from '@/components/Logo'
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from 'lucide-react'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const { confirmPasswordReset } = useAuth()

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (password.length < 8) {
      setErrorMessage('A nova senha deve ter no mínimo 8 caracteres.')
      return
    }

    if (password !== passwordConfirm) {
      setErrorMessage('A confirmação de senha não confere.')
      return
    }

    if (!token) {
      setErrorMessage('Token de recuperação inválido ou expirado. Solicite um novo link.')
      return
    }

    setIsLoading(true)
    try {
      await confirmPasswordReset(token, password, passwordConfirm)
      setIsSuccess(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao redefinir senha.'
      setErrorMessage(msg.includes('token') ? 'Token de redefinição expirado ou inválido.' : msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#FAF7F2]">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#E5E7EB] p-8">
        <div className="flex justify-center mb-6">
          <Logo variant="dark" size="md" />
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-extrabold text-[#030507]">Definir nova senha</h1>
          <p className="text-xs text-[#6B7280] mt-1.5">
            Crie uma senha forte com no mínimo 8 caracteres para sua conta corporativa.
          </p>
        </div>

        {isSuccess ? (
          <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-[#10B981] space-y-4 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto text-[#10B981]" />
            <h2 className="text-base font-bold text-emerald-900">Senha redefinida com sucesso!</h2>
            <p className="text-xs text-emerald-800">
              Sua nova senha já está ativa. Você já pode fazer login no Portal AHM Solution.
            </p>
            <Link
              to="/login"
              className="inline-block w-full py-3 px-4 rounded-xl text-xs font-semibold text-white shadow"
              style={{ backgroundColor: '#DE6464' }}
            >
              Ir para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-[#DC2626] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="new-password"
                className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1.5"
              >
                Nova senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9CA3AF]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#030507] bg-white outline-none focus:border-[#DE6464] focus:ring-2 focus:ring-[#DE6464]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#9CA3AF]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1.5"
              >
                Confirmar nova senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9CA3AF]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="Repita a nova senha"
                  required
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#030507] bg-white outline-none focus:border-[#DE6464] focus:ring-2 focus:ring-[#DE6464]/20"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl font-semibold text-xs text-white shadow-md transition-all duration-150 flex items-center justify-center gap-2 hover:bg-[#D45555] disabled:opacity-60"
              style={{ backgroundColor: '#DE6464' }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando nova senha...</span>
                </>
              ) : (
                <span>Salvar nova senha</span>
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
        )}
      </div>
    </div>
  )
}
