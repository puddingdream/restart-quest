import type { QueryClient } from '../../lib/query/QueryClient'
import {
  queryClient as defaultQueryClient,
} from '../../lib/query/QueryClient'
import { AuthProvider } from '../auth/AuthProvider'
import { AuthRoutes, ProtectedRoute } from '../auth/AuthApp'
import type { AuthApi } from '../auth/authApi'
import { useAuth } from '../auth/authContext'
import { useLocationPath } from '../auth/routing'
import { HistoryPage } from '../history/HistoryPage'
import type { HistoryApi } from '../history/historyApi'
import { RouteLink } from './RouteLink'
import { TodayPage } from './TodayPage'
import type { QuestApi } from './questApi'
import './quest.css'

function ProductNavigation() {
  const { status } = useAuth()
  const location = useLocationPath()
  const pathname = new URL(location, window.location.origin).pathname

  if (status !== 'authenticated') {
    return null
  }

  const links = [
    { label: '오늘', to: '/today' },
    { label: '기록', to: '/history' },
    { label: '계정', to: '/account' },
  ]

  return (
    <nav className="product-nav" aria-label="주요 메뉴">
      {links.map((link) => (
        <RouteLink
          ariaCurrent={pathname === link.to ? 'page' : undefined}
          className={pathname === link.to ? 'product-nav__link product-nav__link--current' : 'product-nav__link'}
          key={link.to}
          to={link.to}
        >
          {link.label}
        </RouteLink>
      ))}
    </nav>
  )
}

function ProductRoutes({
  historyApi,
  queryClient,
  questApi,
}: {
  historyApi?: HistoryApi
  queryClient: QueryClient
  questApi?: QuestApi
}) {
  const { user } = useAuth()
  const location = useLocationPath()
  const pathname = new URL(location, window.location.origin).pathname

  return (
    <>
      <ProductNavigation />
      {pathname === '/today' ? (
        <ProtectedRoute>
          <TodayPage accountId={user?.id} api={questApi} queryClient={queryClient} />
        </ProtectedRoute>
      ) : pathname === '/history' ? (
        <ProtectedRoute>
          <HistoryPage accountId={user?.id} api={historyApi} queryClient={queryClient} />
        </ProtectedRoute>
      ) : (
        <AuthRoutes />
      )}
    </>
  )
}

export function QuestApp({
  authApi,
  historyApi,
  queryClient = defaultQueryClient,
  questApi,
}: {
  authApi?: AuthApi
  historyApi?: HistoryApi
  queryClient?: QueryClient
  questApi?: QuestApi
}) {
  return (
    <AuthProvider api={authApi} queryClient={queryClient}>
      <ProductRoutes historyApi={historyApi} queryClient={queryClient} questApi={questApi} />
    </AuthProvider>
  )
}
