import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from '@/components/Logo'
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Zap,
  Layers,
  History,
  Loader2,
  AlertCircle,
  HelpCircle,
  Linkedin,
  Instagram,
  Globe,
  Info,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()

  const [email, setEmail] = useState('afonso.moreira@ahmsolution.com')
  const [password, setPassword] = useState('Skip@Pass')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [shakeError, setShakeError] = useState(false)

  const [requestAccessModalOpen, setRequestAccessModalOpen] = useState(false)
  const [touched, setTouched] = useState({ email: false, password: false })

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const isPasswordValid = password.length >= 8

  React.useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, location])

  const triggerError = (msg: string) => {
    setErrorMessage(msg)
    setShakeError(true)
    setTimeout(() => setShakeError(false), 350)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ email: true, password: true })
    setErrorMessage('')

    if (!isEmailValid) {
      triggerError('Por favor, informe um email corporativo válido.')
      return
    }

    if (!isPasswordValid) {
      triggerError('A senha deve ter no mínimo 8 caracteres.')
      return
    }

    setIsLoading(true)
    try {
      await login(email, password)
      toast({
        title: 'Bem-vindo de volta!',
        description: 'Login realizado com sucesso no Portal AHM Solution.',
      })
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'
      navigate(from, { replace: true })
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Credenciais inválidas. Verifique seu email corporativo e senha.'
      triggerError(
        msg.includes('Failed to authenticate') ? 'Email corporativo ou senha incorretos.' : msg,
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#FAF7F2]">
      {/* Coluna Esquerda (60% Desktop, oculta no mobile) */}
      <div className="hidden md:flex md:w-3/5 bg-[#030507] text-white flex-col justify-between p-8 lg:p-14 relative overflow-hidden bg-diagonal-pattern border-r border-[#1a1f26]">
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ backgroundColor: '#DE6464' }}
        />
        <div
          className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full blur-3xl opacity-15 pointer-events-none"
          style={{ backgroundColor: '#E5BE94' }}
        />

        <div className="relative z-10">
          <Logo variant="light" size="lg" />
        </div>

        <div className="relative z-10 max-w-xl my-auto py-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-6 bg-[#DE6464]/10 text-[#DE6464] border border-[#DE6464]/30">
            <span className="w-2 h-2 rounded-full bg-[#DE6464] animate-pulse" />
            Portal Comercial Integrado
          </div>

          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white mb-4 leading-tight">
            Bem-vindo ao Portal de Atendimento AHM
          </h1>
          <p className="text-base text-[#9CA3AF] mb-8 leading-relaxed">
            Plataforma centralizada de gestão de tickets, suporte comercial e atendimento
            operacional da AHM Solution. Projetada para otimizar a experiência dos nossos clientes e
            impulsionar os resultados da nossa equipe.
          </p>

          <div className="space-y-4">
            <div className="flex items-start gap-4 p-3.5 rounded-xl bg-white/[0.03] border border-white/5 backdrop-blur-sm transition-all hover:bg-white/[0.06]">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(222, 100, 100, 0.15)', color: '#DE6464' }}
              >
                <Zap className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Atendimento ágil</h2>
                <p className="text-xs text-[#9CA3AF] mt-0.5">
                  Resolução rápida de cotações, ocorrências de frete e dúvidas operacionais com SLA
                  monitorado.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-3.5 rounded-xl bg-white/[0.03] border border-white/5 backdrop-blur-sm transition-all hover:bg-white/[0.06]">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(222, 100, 100, 0.15)', color: '#DE6464' }}
              >
                <Layers className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Gestão centralizada</h2>
                <p className="text-xs text-[#9CA3AF] mt-0.5">
                  Tickets organizados por canal (WhatsApp, Telefone, Email e Chat) com distribuição
                  inteligente.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-3.5 rounded-xl bg-white/[0.03] border border-white/5 backdrop-blur-sm transition-all hover:bg-white/[0.06]">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(222, 100, 100, 0.15)', color: '#DE6464' }}
              >
                <History className="w-5 h-5" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Histórico completo</h2>
                <p className="text-xs text-[#9CA3AF] mt-0.5">
                  Trilha de auditoria integral, notas internas e status em tempo real de cada
                  negociação comercial.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between pt-6 border-t border-white/10 text-xs text-[#9CA3AF]">
          <span>© {new Date().getFullYear()} AHM Solution Brasil Ltda.</span>
          <div className="flex items-center gap-4">
            <a
              href="https://www.ahmsolution.com.br"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Website AHM Solution"
              className="text-[#9CA3AF] hover:text-[#DE6464] transition-colors"
            >
              <Globe className="w-4 h-4" />
            </a>
            <a
              href="https://www.linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn AHM Solution"
              className="text-[#9CA3AF] hover:text-[#DE6464] transition-colors"
            >
              <Linkedin className="w-4 h-4" />
            </a>
            <a
              href="https://www.instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram AHM Solution"
              className="text-[#9CA3AF] hover:text-[#DE6464] transition-colors"
            >
              <Instagram className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Coluna Direita (40% Desktop, 100% Mobile) */}
      <div className="w-full md:w-2/5 flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-14 bg-white relative shadow-2xl">
        <div className="md:hidden flex items-center justify-between mb-8 pb-4 border-b border-[#E5E7EB]">
          <Logo variant="dark" size="md" />
        </div>

        <div className="w-full max-w-md mx-auto">
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#030507] tracking-tight">
              Acesse sua conta
            </h2>
            <p className="text-sm text-[#6B7280] mt-1.5">
              Entre com suas credenciais para acessar o sistema
            </p>
          </div>

          <div className="mb-6 p-3 rounded-xl bg-[#FAF7F2] border border-[#E5E7EB] flex items-start gap-2.5 text-xs text-[#030507]">
            <Info className="w-4 h-4 text-[#DE6464] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#030507]">Acesso de Demonstração / Comercial:</p>
              <p className="text-[#6B7280]">
                Email:{' '}
                <span className="font-mono text-[#030507]">afonso.moreira@ahmsolution.com</span>
                <br />
                Senha: <span className="font-mono text-[#030507]">Skip@Pass</span>
              </p>
            </div>
          </div>

          {errorMessage && (
            <div
              className={`mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-[#DC2626] text-xs flex items-center gap-2.5 ${
                shakeError ? 'animate-shake' : ''
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-medium leading-relaxed">{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="corporate-email"
                className="block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-2"
              >
                Email corporativo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9CA3AF]">
                  <Mail className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <input
                  id="corporate-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched({ ...touched, email: true })}
                  placeholder="nome@ahmsolution.com.br"
                  required
                  className={`w-full pl-11 pr-4 py-3 rounded-xl border text-sm text-[#030507] bg-white transition-all outline-none focus:ring-2 focus:ring-[#DE6464]/30 ${
                    touched.email && !isEmailValid
                      ? 'border-[#DC2626] focus:border-[#DC2626]'
                      : 'border-[#E5E7EB] focus:border-[#DE6464]'
                  }`}
                />
              </div>
              {touched.email && !isEmailValid && (
                <p className="text-xs text-[#DC2626] mt-1.5 pl-1">
                  Digite um endereço de email válido.
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="user-password"
                  className="block text-xs font-semibold uppercase tracking-wider text-[#030507]"
                >
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-xs font-semibold transition-colors hover:underline"
                  style={{ color: '#DE6464' }}
                >
                  Esqueceu sua senha?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9CA3AF]">
                  <Lock className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <input
                  id="user-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setTouched({ ...touched, password: true })}
                  placeholder="••••••••"
                  required
                  className={`w-full pl-11 pr-11 py-3 rounded-xl border text-sm text-[#030507] bg-white transition-all outline-none focus:ring-2 focus:ring-[#DE6464]/30 ${
                    touched.password && !isPasswordValid
                      ? 'border-[#DC2626] focus:border-[#DC2626]'
                      : 'border-[#E5E7EB] focus:border-[#DE6464]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#9CA3AF] hover:text-[#030507] transition-colors duration-150"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" strokeWidth={1.5} />
                  ) : (
                    <Eye className="w-5 h-5" strokeWidth={1.5} />
                  )}
                </button>
              </div>
              {touched.password && !isPasswordValid && (
                <p className="text-xs text-[#DC2626] mt-1.5 pl-1">
                  A senha deve conter no mínimo 8 caracteres.
                </p>
              )}
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-[#E5E7EB] text-[#DE6464] focus:ring-[#DE6464] cursor-pointer accent-[#DE6464]"
                />
                <span className="text-xs font-medium text-[#6B7280]">Manter-me conectado</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-6 rounded-xl font-semibold text-sm text-white shadow-md transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed hover:bg-[#D45555] active:scale-[0.99]"
              style={{ backgroundColor: '#DE6464' }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validando credenciais...</span>
                </>
              ) : (
                <span>Entrar</span>
              )}
            </button>
          </form>

          <div className="relative my-7">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E5E7EB]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-[#9CA3AF] font-semibold tracking-wider">ou</span>
            </div>
          </div>

          <div className="text-center text-xs text-[#6B7280]">
            Novo por aqui? Fale com o administrador.{' '}
            <button
              type="button"
              onClick={() => setRequestAccessModalOpen(true)}
              className="font-bold underline underline-offset-2 transition-colors hover:text-[#C94F4F]"
              style={{ color: '#DE6464' }}
            >
              Solicitar acesso
            </button>
          </div>
        </div>
      </div>

      {/* Modal Solicitar Acesso */}
      <Dialog open={requestAccessModalOpen} onOpenChange={setRequestAccessModalOpen}>
        <DialogContent className="max-w-md bg-white p-6 rounded-2xl modal-ahm">
          <DialogHeader>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2 bg-[#DE6464]/10 text-[#DE6464]">
              <HelpCircle className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-[#030507]">
              Solicitação de Acesso ao Sistema
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B7280] leading-relaxed">
              O acesso ao Portal de Atendimento é restrito a colaboradores e representantes
              autorizados da AHM Solution.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3.5 text-xs text-[#030507]">
            <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E5E7EB]">
              <p className="font-semibold text-[#030507] mb-1">
                Contatos do Administrador de TI / RH:
              </p>
              <p className="text-[#6B7280] leading-relaxed">
                • Email:{' '}
                <span className="font-medium text-[#030507]">suporte.ti@ahmsolution.com.br</span>
                <br />• Telefone interno:{' '}
                <span className="font-medium text-[#030507]">(11) 3456-7890 (Ramal 204)</span>
                <br />• Horário: Segunda a Sexta, das 08h às 18h
              </p>
            </div>
            <p className="text-[#6B7280]">
              Ao solicitar, informe seu nome completo, departamento (ex: Comercial, Operações) e seu
              gestor imediato para aprovação célere.
            </p>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => setRequestAccessModalOpen(false)}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition-colors"
              style={{ backgroundColor: '#DE6464' }}
            >
              Entendido
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
