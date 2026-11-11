import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'

// Páginas Públicas
import Login from '@/pages/Login'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'
import VerifyEmail from '@/pages/VerifyEmail'
import ConfirmEmailChange from '@/pages/ConfirmEmailChange'
import NotFound from '@/pages/NotFound'

// Páginas Protegidas
import Dashboard from '@/pages/Dashboard'
import Tickets from '@/pages/Tickets'
import Atendimentos from '@/pages/Atendimentos'
import Equipe from '@/pages/Equipe'
import Produtos from '@/pages/Produtos'
import Leads from '@/pages/Leads'
import Transbordos from '@/pages/Transbordos'
import Oportunidades from '@/pages/Oportunidades'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
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
            <Route path="/" element={<Dashboard />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/atendimentos" element={<Atendimentos />} />
            <Route path="/equipe" element={<Equipe />} />
            <Route path="/produtos" element={<Produtos />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/transbordos" element={<Transbordos />} />
            <Route path="/oportunidades" element={<Oportunidades />} />
          </Route>

          {/* 404 e Redirecionamentos */}
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
