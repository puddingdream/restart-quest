import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ApiError } from '../../lib/api/ApiClient'
import type { User } from '../../lib/api/contracts'
import { queryClient as defaultQueryClient, type QueryClient } from '../../lib/query/QueryClient'
import { authApi as defaultAuthApi, type AuthApi, type Credentials } from './authApi'
import { AuthContext, type AuthContextValue } from './authContext'
import { loginPathFor, navigate } from './routing'

const sessionQueryKey = 'auth.me'

export type AuthStatus = 'anonymous' | 'authenticated' | 'error' | 'restoring'

type AuthProviderProps = {
  api?: AuthApi
  children: ReactNode
  queryClient?: QueryClient
}

function isAuthenticationRequired(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : '세션을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

export function AuthProvider({
  api = defaultAuthApi,
  children,
  queryClient = defaultQueryClient,
}: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>('restoring')
  const [user, setUser] = useState<User | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const statusRef = useRef<AuthStatus>('restoring')

  const updateStatus = useCallback((nextStatus: AuthStatus) => {
    statusRef.current = nextStatus
    setStatus(nextStatus)
  }, [])

  const restoreSession = useCallback(async () => {
    updateStatus('restoring')
    setRestoreError(null)

    try {
      const restoredUser = await queryClient.fetchQuery(sessionQueryKey, () => api.me())
      setUser(restoredUser)
      updateStatus('authenticated')
    } catch (error) {
      queryClient.invalidate(sessionQueryKey)
      setUser(null)

      if (isAuthenticationRequired(error)) {
        updateStatus('anonymous')
      } else {
        setRestoreError(errorMessage(error))
        updateStatus('error')
      }
    }
  }, [api, queryClient, updateStatus])

  useEffect(() => {
    queueMicrotask(() => void restoreSession())
  }, [restoreSession])

  useEffect(
    () =>
      api.onUnauthorized(() => {
        if (statusRef.current !== 'authenticated') {
          return
        }

        queryClient.invalidate(sessionQueryKey)
        setUser(null)
        setRestoreError(null)
        updateStatus('anonymous')

        const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`
        navigate(loginPathFor(returnTo), { replace: true })
      }),
    [api, queryClient, updateStatus],
  )

  const login = useCallback(
    async (credentials: Credentials) => {
      const authenticatedUser = await api.login(credentials)
      queryClient.setQueryData(sessionQueryKey, authenticatedUser)
      setUser(authenticatedUser)
      setRestoreError(null)
      updateStatus('authenticated')
    },
    [api, queryClient, updateStatus],
  )

  const register = useCallback(
    async (credentials: Credentials) => {
      const authenticatedUser = await api.register(credentials)
      queryClient.setQueryData(sessionQueryKey, authenticatedUser)
      setUser(authenticatedUser)
      setRestoreError(null)
      updateStatus('authenticated')
    },
    [api, queryClient, updateStatus],
  )

  const logout = useCallback(async () => {
    await api.logout()
    queryClient.invalidate(sessionQueryKey)
    setUser(null)
    setRestoreError(null)
    updateStatus('anonymous')
  }, [api, queryClient, updateStatus])

  const value = useMemo<AuthContextValue>(
    () => ({ login, logout, register, restoreError, restoreSession, status, user }),
    [login, logout, register, restoreError, restoreSession, status, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
