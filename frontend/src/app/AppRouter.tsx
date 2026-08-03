import { useEffect } from 'react'
import { AuthPage } from '../features/auth/pages/AuthPage'
import { useAuth } from '../features/auth/AuthContext'
import { OnboardingPage } from '../features/onboarding/pages/OnboardingPage'
import { LoadingScreen } from './components/LoadingScreen'
import { ProtectedRoutePlaceholder } from './components/ProtectedRoutePlaceholder'
import { resolveRoute, useAppNavigation, type ViewRoute } from './routing'

function renderRoute(route: ViewRoute) {
  switch (route) {
    case '/login':
      return <AuthPage key="login" mode="login" />
    case '/signup':
      return <AuthPage key="signup" mode="signup" />
    case '/onboarding':
      return <OnboardingPage />
    case '/today':
      return <ProtectedRoutePlaceholder route="today" />
    case '/dashboard':
      return <ProtectedRoutePlaceholder route="dashboard" />
  }
}

export function AppRouter() {
  const { status, user } = useAuth()
  const { pathname, navigate } = useAppNavigation()
  const decision = status === 'checking' ? null : resolveRoute(pathname, user)

  useEffect(() => {
    if (decision?.kind === 'redirect') {
      navigate(decision.to, { replace: true })
    }
  }, [decision, navigate])

  if (status === 'checking') {
    return <LoadingScreen label="세션을 안전하게 확인하고 있어요." />
  }
  if (!decision || decision.kind === 'redirect') {
    return <LoadingScreen label="알맞은 시작 화면으로 이동하고 있어요." />
  }

  return renderRoute(decision.route)
}
