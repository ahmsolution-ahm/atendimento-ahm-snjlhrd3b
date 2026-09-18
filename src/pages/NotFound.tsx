import { Link, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Logo } from '@/components/Logo'
import { ArrowLeft, AlertCircle } from 'lucide-react'

const NotFound = () => {
  const location = useLocation()

  useEffect(() => {
    console.error('Erro 404: Rota não encontrada:', location.pathname)
  }, [location.pathname])

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#FAF7F2]">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-[#E5E7EB] p-8 text-center">
        <div className="flex justify-center mb-6">
          <Logo variant="dark" size="md" />
        </div>

        <div className="w-14 h-14 rounded-full bg-red-100 text-[#DE6464] flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>

        <h1 className="text-3xl font-extrabold text-[#030507] mb-2">404</h1>
        <p className="text-sm font-semibold text-[#030507] mb-1">Página não encontrada</p>
        <p className="text-xs text-[#6B7280] mb-6">
          A rota informada não existe ou foi movida. Retorne ao painel comercial da AHM Solution.
        </p>

        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl text-xs font-semibold text-white shadow-md transition-all hover:bg-[#C94F4F]"
          style={{ backgroundColor: '#DE6464' }}
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao Início
        </Link>
      </div>
    </div>
  )
}

export default NotFound
