import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from '@/components/Logo'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const { confirmVerification } = useAuth()

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMessage('Token de verificação ausente ou link incompleto.')
      return
    }

    let isMounted = true
    confirmVerification(token)
      .then(() => {
        if (isMounted) setStatus('success')
      })
      .catch((err) => {
        if (isMounted) {
          setStatus('error')
          setErrorMessage(err instanceof Error ? err.message : 'Falha na verificação.')
        }
      })

    return () => {
      isMounted = false
    }
  }, [token, confirmVerification])

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#FAF7F2]">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#E5E7EB] p-8 text-center">
        <div className="flex justify-center mb-6">
          <Logo variant="dark" size="md" />
        </div>

        {status === 'verifying' && (
          <div className="space-y-4 py-6">
            <Loader2 className="w-10 h-10 animate-spin text-[#DE6464] mx-auto" />
            <h1 className="text-lg font-bold text-[#030507]">Verificando seu email...</h1>
            <p className="text-xs text-[#6B7280]">
              Aguarde um instante enquanto validamos sua credencial institucional.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4 py-2">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-[#10B981] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold text-[#030507]">Email verificado com sucesso</h1>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Sua conta foi autenticada e validada junto aos servidores da AHM Solution. Agora você
              pode entrar com acesso integral às rotas do portal.
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
        )}

        {status === 'error' && (
          <div className="space-y-4 py-2">
            <div className="w-14 h-14 rounded-full bg-red-100 text-[#DC2626] flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold text-[#030507]">Falha na verificação</h1>
            <p className="text-xs text-[#DC2626]">{errorMessage}</p>
            <p className="text-xs text-[#6B7280]">
              O link pode ter expirado ou já ter sido utilizado anteriormente.
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
        )}
      </div>
    </div>
  )
}
