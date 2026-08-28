import { useEffect } from 'react'
import { AuthPage } from '../features/auth/pages/AuthPage'
import { useAuth } from '../features/auth/AuthContext'
import { DashboardPage } from '../features/dashboard/pages/DashboardPage'
import { OnboardingPage } from '../features/onboarding/pages/OnboardingPage'
import { TodayPage } from '../features/quests/pages/TodayPage'
import { LoadingScreen } from './components/LoadingScreen'
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
      return <TodayPage />
    case '/dashboard':
      return <DashboardPage />
  }
}

export function AppRouter() {
  const { status, user, retrySession } = useAuth()
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
  if (status === 'unavailable') {
    return (
      <main className="page-container" role="alert">
        <section className="surface-card">
          <h1>서버에 잠시 연결할 수 없어요</h1>
          <p>로그인 정보는 그대로 보관했습니다. 연결을 확인한 뒤 다시 시도해 주세요.</p>
          <button className="button button-primary" onClick={retrySession}>
            다시 연결하기
          </button>
        </section>
      </main>
    )
  }
  if (!decision || decision.kind === 'redirect') {
    return <LoadingScreen label="알맞은 시작 화면으로 이동하고 있어요." />
  }

  return renderRoute(decision.route)
}
