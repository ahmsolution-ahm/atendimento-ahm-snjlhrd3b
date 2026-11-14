import { useState } from 'react'
import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from '@/components/Logo'
import {
  Home,
  Users,
  Package,
  UserPlus,
  ArrowLeftRight,
  Target,
  BarChart3,
  TrendingUp,
  Sparkles,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// Fase 2 · Bloco C: menu do CRM. Tickets e Atendimentos (portal antigo) saíram do menu — as
// rotas continuam existindo para links e histórico. O botão principal passou a ser "Novo lead"
// e o sino de tickets saiu do topo (era do portal antigo).
// Bloco B: área de trabalho na largura inteira; menu com letra e ícones maiores.

export default function Layout() {
  const { user, logout, isAdmin } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    toast({
      title: 'Sessão encerrada',
      description: 'Você saiu da sua conta com segurança.',
    })
    navigate('/login')
  }

  const getPageTitle = () => {
    const p = location.pathname
    if (p === '/') return 'Minha mesa'
    if (p.startsWith('/oportunidades/')) return 'Oportunidade'
    switch (p) {
      case '/tickets':
        return 'Gestão de Tickets'
      case '/atendimentos':
        return 'Atendimentos em Tempo Real'
      case '/equipe':
        return 'Equipe e permissões'
      case '/produtos':
        return 'Catálogo de Produtos'
      case '/leads':
        return 'Gestão de Leads'
      case '/transbordos':
        return 'Transbordos'
      case '/oportunidades':
        return 'Oportunidades'
      case '/metricas':
        return 'Métricas'
      case '/desempenho':
        return 'Desempenho'
      case '/ia':
        return 'IA de vendas'
      case '/importar-pipedrive':
        return 'Importar do Pipedrive'
      default:
        return 'AHM Solution'
    }
  }

  const navItems = [
    { name: 'Minha mesa', path: '/', icon: Home },
    { name: 'Leads', path: '/leads', icon: UserPlus },
    { name: 'Oportunidades', path: '/oportunidades', icon: Target },
    { name: 'Transbordos', path: '/transbordos', icon: ArrowLeftRight },
    { name: 'Métricas', path: '/metricas', icon: BarChart3 },
    { name: 'Desempenho', path: '/desempenho', icon: TrendingUp },
    { name: 'Produtos', path: '/produtos', icon: Package },
    // Bloco 3: gestão de usuários só para administrador; IA de vendas (F0) também
    ...(isAdmin
      ? [
          { name: 'IA de vendas', path: '/ia', icon: Sparkles },
          { name: 'Equipe', path: '/equipe', icon: Users },
        ]
      : []),
  ]

  const ativo = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(`${path}/`))

  const papel = isAdmin ? 'Administrador' : 'Vendedor'
  const inicial = user?.name ? user.name.charAt(0).toUpperCase() : 'U'

  const botaoNovoLead = (aoClicar?: () => void) => (
    <Link
      to="/leads?novo=1"
      onClick={aoClicar}
      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white shadow-md transition-all duration-150 hover:bg-[#C94F4F] active:scale-[0.98]"
      style={{ backgroundColor: '#DE6464' }}
    >
      <UserPlus className="w-5 h-5" strokeWidth={1.5} />
      <span>Novo lead</span>
    </Link>
  )

  return (
    <div className="min-h-screen flex bg-[#FAF7F2] text-[#030507]">
      {/* Menu lateral (desktop) */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#030507] text-white shrink-0 sidebar-ahm z-30 select-none">
        <div className="h-16 flex items-center px-6 border-b border-[#1A1F26]">
          <Logo variant="light" size="md" />
        </div>

        <div className="p-4">{botaoNovoLead()}</div>

        <nav className="flex-1 px-3 py-2 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = ativo(item.path)
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-150 relative ${
                  isActive
                    ? 'text-white bg-[#DE6464] shadow-md shadow-[#DE6464]/20'
                    : 'text-[#9CA3AF] hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${isActive ? 'text-white' : 'text-[#9CA3AF]'}`}
                  strokeWidth={1.5}
                />
                <span>{item.name}</span>
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />}
              </NavLink>
            )
          })}
        </nav>

        <div className="p-3 border-t border-[#1A1F26]">
          <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.04]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm text-white shrink-0"
                style={{ backgroundColor: '#DE6464' }}
              >
                {inicial}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {user?.name || 'Usuário'}
                </p>
                <p className="text-xs text-[#9CA3AF] truncate">{user?.email || ''}</p>
                <p className="text-xs font-semibold text-[#E5BE94]">{papel}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Sair do sistema"
              aria-label="Sair do sistema"
              className="p-2 rounded-lg text-[#9CA3AF] hover:text-[#DE6464] hover:bg-white/[0.08] transition-colors"
            >
              <LogOut className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </aside>

      {/* Menu deslizante (celular) */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex flex-col w-72 max-w-[85vw] bg-[#030507] text-white p-4 z-50 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#1A1F26]">
              <Logo variant="light" size="sm" />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Fechar menu"
                className="p-1 rounded-lg text-[#9CA3AF] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4">{botaoNovoLead(() => setMobileMenuOpen(false))}</div>

            <nav className="flex-1 space-y-1.5 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = ativo(item.path)
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold ${
                      isActive
                        ? 'text-white bg-[#DE6464]'
                        : 'text-[#9CA3AF] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-5 h-5" strokeWidth={1.5} />
                    <span>{item.name}</span>
                  </NavLink>
                )
              })}
            </nav>

            <div className="pt-4 border-t border-[#1A1F26] flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {user?.name || 'Usuário'}
                </p>
                <p className="text-xs text-[#9CA3AF] truncate">{user?.email}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Sair do sistema"
                className="p-2 text-[#DE6464]"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Área principal */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-[#E5E7EB] px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-[#030507] hover:bg-[#FAF7F2] transition-colors"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" strokeWidth={1.5} />
            </button>
            <h1 className="text-lg sm:text-xl font-extrabold text-[#030507] tracking-tight">
              {getPageTitle()}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-white shadow-sm"
              style={{ backgroundColor: '#030507', border: '1.5px solid #DE6464' }}
            >
              {inicial}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-bold text-[#030507] leading-tight">
                {user?.name || 'Usuário'}
              </p>
              <span className="text-xs text-[#6B7280] font-semibold">{papel}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 2xl:px-12 w-full">
          <Outlet />
        </main>

        <footer className="px-6 py-4 border-t border-[#E5E7EB] bg-white text-sm text-[#9CA3AF] flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span className="font-semibold text-[#030507]">AHM Solution</span> — Portal Comercial
          </div>
          <div>© {new Date().getFullYear()} Todos os direitos reservados.</div>
        </footer>
      </div>
    </div>
  )
}
