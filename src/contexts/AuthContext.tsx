import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import type { UserRecord } from '@/types'

interface AuthContextType {
  user: UserRecord | null
  token: string | null
  isAuthenticated: boolean
  // Bloco 3: só para mostrar/esconder elementos — quem decide o acesso é o servidor
  isAdmin: boolean
  isLoading: boolean
  login: (email: string, pass: string, lembrar?: boolean) => Promise<void>
  logout: () => void
  requestPasswordReset: (email: string) => Promise<void>
  confirmPasswordReset: (token: string, password: string, passwordConfirm: string) => Promise<void>
  confirmVerification: (token: string) => Promise<void>
  confirmEmailChange: (token: string, password: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Bloco B: "Manter-me conectado". Desmarcado = a sessão termina quando o navegador é fechado.
// Marca no localStorage "não lembrar" + um cookie de sessão (sem validade, some ao fechar o
// navegador e vale para todas as abas). Ao abrir o app: marca presente e cookie ausente = sair.
const CHAVE_NAO_LEMBRAR = 'ahm_nao_lembrar'
const COOKIE_SESSAO = 'ahm_sessao_aberta'

const sessaoDeveExpirar = (): boolean => {
  try {
    if (localStorage.getItem(CHAVE_NAO_LEMBRAR) !== '1') return false
    return !document.cookie.split('; ').some((c) => c.startsWith(`${COOKIE_SESSAO}=`))
  } catch {
    return false
  }
}

const registrarPreferenciaSessao = (lembrar: boolean) => {
  try {
    if (lembrar) {
      localStorage.removeItem(CHAVE_NAO_LEMBRAR)
    } else {
      localStorage.setItem(CHAVE_NAO_LEMBRAR, '1')
      document.cookie = `${COOKIE_SESSAO}=1; path=/; SameSite=Lax`
    }
  } catch {
    /* navegador sem armazenamento: a sessão segue o padrão (lembrar) */
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserRecord | null>(
    (pb.authStore.record as unknown as UserRecord) || null,
  )
  const [token, setToken] = useState<string | null>(pb.authStore.token || null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Escutar mudanças no store de autenticação do PocketBase
    const unsubscribe = pb.authStore.onChange((newToken, model) => {
      setToken(newToken || null)
      setUser((model as unknown as UserRecord) || null)
    })

    // "Manter-me conectado" desmarcado e navegador reaberto: encerra a sessão salva
    if (sessaoDeveExpirar()) {
      pb.authStore.clear()
    }

    // Checagem inicial de validade do token
    if (pb.authStore.isValid && pb.authStore.record) {
      setUser(pb.authStore.record as unknown as UserRecord)
      setToken(pb.authStore.token)
      // Bloco 3: recarrega o registro do usuário para refletir uma troca de papel recente
      pb.collection('users')
        .authRefresh({ requestKey: null })
        .catch(() => {
          /* sem conexão: segue com o registro salvo; o servidor continua validando */
        })
    } else {
      pb.authStore.clear()
      setUser(null)
      setToken(null)
    }

    setIsLoading(false)

    return () => {
      unsubscribe()
    }
  }, [])

  const login = async (email: string, pass: string, lembrar: boolean = true) => {
    const authData = await pb.collection('users').authWithPassword(email, pass)
    registrarPreferenciaSessao(lembrar)
    setUser(authData.record as unknown as UserRecord)
    setToken(authData.token)
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
    setToken(null)
  }

  const requestPasswordReset = async (email: string) => {
    await pb.collection('users').requestPasswordReset(email)
  }

  const confirmPasswordReset = async (resetToken: string, pass: string, passConfirm: string) => {
    await pb.collection('users').confirmPasswordReset(resetToken, pass, passConfirm)
  }

  const confirmVerification = async (verifyToken: string) => {
    await pb.collection('users').confirmVerification(verifyToken)
  }

  const confirmEmailChange = async (emailToken: string, pass: string) => {
    await pb.collection('users').confirmEmailChange(emailToken, pass)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isAdmin: user?.papel === 'admin',
        isLoading,
        login,
        logout,
        requestPasswordReset,
        confirmPasswordReset,
        confirmVerification,
        confirmEmailChange,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider')
  }
  return context
}
