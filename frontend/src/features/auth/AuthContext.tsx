/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { authApi } from './api/authApi'
import { clearAuthMockSession } from './api/authMockApi'
import type { AuthUser, LoginInput, SignupInput } from './types'
import {
  clearAccessToken,
  getAccessToken,
  storeAccessToken,
} from '../../shared/auth/sessionToken'

type AuthStatus = 'checking' | 'anonymous' | 'authenticated'

interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  login: (input: LoginInput) => Promise<void>
  signup: (input: SignupInput) => Promise<void>
  markOnboardingCompleted: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('checking')
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    let active = true
    if (!getAccessToken()) {
      setStatus('anonymous')
      return () => {
        active = false
      }
    }

    authApi
      .me()
      .then((currentUser) => {
        if (!active) return
        setUser(currentUser)
        setStatus('authenticated')
      })
      .catch(() => {
        if (!active) return
        clearAccessToken()
        clearAuthMockSession()
        setUser(null)
        setStatus('anonymous')
      })

    return () => {
      active = false
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      async login(input) {
        const response = await authApi.login(input)
        storeAccessToken(response.accessToken)
        setUser(response.user)
        setStatus('authenticated')
      },
      async signup(input) {
        const response = await authApi.signup(input)
        storeAccessToken(response.accessToken)
        setUser(response.user)
        setStatus('authenticated')
      },
      markOnboardingCompleted() {
        setUser((current) =>
          current ? { ...current, onboardingCompleted: true } : current,
        )
      },
      logout() {
        clearAccessToken()
        clearAuthMockSession()
        setUser(null)
        setStatus('anonymous')
      },
    }),
    [status, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider 안에서 useAuth를 사용해야 합니다.')
  return value
}
