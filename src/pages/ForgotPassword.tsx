import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from '@/components/Logo'
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMessage('Por favor, informe um email válido.')
      return
    }

    setIsLoading(true)
    try {
      await requestPasswordReset(email)
      setIsSuccess(true)
    } catch (err: unknown) {
      // Por segurança, exibe sucesso mesmo ou orienta
      setIsSuccess(true)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#FAF7F2]">
      {/* Coluna Esquerda Institucional */}
      <div className="hidden md:flex md:w-3/5 bg-[#030507] text-white flex-col justify-between p-8 lg:p-14 relative overflow-hidden bg-diagonal-pattern border-r border-[#1a1f26]">
        <div className="relative z-10">
          <Logo variant="light" size="lg" />
        </div>

        <div className="relative z-10 max-w-xl my-auto py-8">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-6 bg-[#DE6464]/10 text-[#DE6464] border border-[#DE6464]/30">
            Segurança & Proteção de Dados
          </span>
          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white mb-4">
            Recupere o acesso à sua conta corporativa
          </h1>
          <p className="text-base text-[#9CA3AF] leading-relaxed">
            Caso você tenha esquecido sua credencial de acesso, enviaremos um link criptografado com
            token de utilização única para o seu email de cadastro.
          </p>
        </div>

        <div className="relative z-10 text-xs text-[#9CA3AF] pt-6 border-t border-white/10">
          © {new Date().getFullYear()} AHM Solution Brasil Ltda.
        </div>
      </div>

      {/* Coluna Direita Formulário */}
      <div className="w-full md:w-2/5 flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-14 bg-white relative shadow-2xl">
        <div className="md:hidden flex items-center justify-between mb-8 pb-4 border-b border-[#E5E7EB]">
          <Logo variant="dark" size="md" />
        </div>

        <div className="w-full max-w-md mx-auto">
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#030507] tracking-tight">
              Recuperar senha
            </h2>
            <p className="text-sm text-[#6B7280] mt-1.5">
              Enviaremos um link de redefinição para seu email corporativo
            </p>
          </div>

          {isSuccess ? (
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-[#10B981] space-y-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-[#10B981] shrink-0" />
                <h3 className="text-sm font-bold text-emerald-900">Link de recuperação enviado!</h3>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Verifique a caixa de entrada de <strong className="font-semibold">{email}</strong>.
                Enviamos as instruções e o link seguro para redefinição.
              </p>
              <div className="pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-xs font-bold text-[#DE6464] hover:underline"
                >
                  <ArrowLeft className="w-4 h-4" /> Voltar para o login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-[#DC2626] text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="font-medium">{errorMessage}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="reset-email"
                  className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-2"
                >
                  Email corporativo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9CA3AF]">
                    <Mail className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nome@ahmsolution.com.br"
                    required
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#E5E7EB] text-sm text-[#030507] bg-white transition-all outline-none focus:ring-2 focus:ring-[#DE6464]/30 focus:border-[#DE6464]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 rounded-xl font-semibold text-sm text-white shadow-md transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed hover:bg-[#D45555]"
                style={{ backgroundColor: '#DE6464' }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enviando link...</span>
                  </>
                ) : (
                  <span>Enviar link de recuperação</span>
                )}
              </button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-[#6B7280] hover:text-[#030507] transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Voltar para o login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
