import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'

// Desempenho: cada tela carrega sob demanda (code splitting) — o navegador baixa
// apenas o código da tela em uso, em vez de um pacote único de 2,8 MB.
const Login = lazy(() => import('@/pages/Login'))
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'))
const ResetPassword = lazy(() => import('@/pages/ResetPassword'))
const VerifyEmail = lazy(() => import('@/pages/VerifyEmail'))
const ConfirmEmailChange = lazy(() => import('@/pages/ConfirmEmailChange'))
const NotFound = lazy(() => import('@/pages/NotFound'))

// Bloco C: a tela inicial passou a ser a "Minha mesa" (o antigo painel de tickets saiu)
const MinhaMesa = lazy(() => import('@/pages/MinhaMesa'))
const Desempenho = lazy(() => import('@/pages/Desempenho'))
const ImportarPipedrive = lazy(() => import('@/pages/ImportarPipedrive'))
const Tickets = lazy(() => import('@/pages/Tickets'))
const Atendimentos = lazy(() => import('@/pages/Atendimentos'))
const Equipe = lazy(() => import('@/pages/Equipe'))
const Produtos = lazy(() => import('@/pages/Produtos'))
const Leads = lazy(() => import('@/pages/Leads'))
const Transbordos = lazy(() => import('@/pages/Transbordos'))
const Oportunidades = lazy(() => import('@/pages/Oportunidades'))
const OportunidadeDetalhe = lazy(() => import('@/pages/OportunidadeDetalhe'))
const Metricas = lazy(() => import('@/pages/Metricas'))

// Tela de carregamento durante a troca de página (sem tela em branco)
const Carregando = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2]">
    <div className="text-center">
      <div className="w-10 h-10 border-4 border-[#DE6464] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-sm text-[#6B7280]">Carregando…</p>
    </div>
  </div>
)

// Bloco 3: tela de gestão de usuários só para administrador (o servidor também recusa)
const SomenteAdmin = ({ children }: { children: ReactNode }) => {
  const { isAdmin } = useAuth()
  return isAdmin ? <>{children}</> : <Navigate to="/" replace />
}

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Suspense fallback={<Carregando />}>
          <Routes>
            {/* Rotas Públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/confirm-email-change" element={<ConfirmEmailChange />} />

            {/* Rotas Protegidas com Layout Global */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<MinhaMesa />} />
              <Route path="/desempenho" element={<Desempenho />} />
              <Route
                path="/importar-pipedrive"
                element={
                  <SomenteAdmin>
                    <ImportarPipedrive />
                  </SomenteAdmin>
                }
              />
              <Route path="/tickets" element={<Tickets />} />
              <Route path="/atendimentos" element={<Atendimentos />} />
              <Route
                path="/equipe"
                element={
                  <SomenteAdmin>
                    <Equipe />
                  </SomenteAdmin>
                }
              />
              <Route path="/produtos" element={<Produtos />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/transbordos" element={<Transbordos />} />
              <Route path="/oportunidades" element={<Oportunidades />} />
              <Route path="/oportunidades/:id" element={<OportunidadeDetalhe />} />
              <Route path="/metricas" element={<Metricas />} />
            </Route>

            {/* 404 e Redirecionamentos */}
            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </Suspense>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
