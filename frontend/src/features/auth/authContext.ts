import { createContext, useContext } from 'react'
import type { User } from '../../lib/api/contracts'
import type { Credentials } from './authApi'
import type { AuthStatus } from './AuthProvider'

export type AuthContextValue = {
  login(credentials: Credentials): Promise<void>
  logout(): Promise<void>
  register(credentials: Credentials): Promise<void>
  restoreSession(): Promise<void>
  restoreError: string | null
  status: AuthStatus
  user: User | null
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)

  if (!value) {
    throw new Error('useAuth는 AuthProvider 안에서 사용해야 합니다.')
  }

  return value
}
