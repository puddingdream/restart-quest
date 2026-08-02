import { useCallback, useEffect, useState } from 'react'

export type AppPath =
  | '/'
  | '/login'
  | '/signup'
  | '/onboarding'
  | '/today'
  | '/dashboard'

export type ViewRoute = Exclude<AppPath, '/'>

interface RouteUser {
  onboardingCompleted: boolean
}

export type RouteDecision =
  | { kind: 'view'; route: ViewRoute }
  | { kind: 'redirect'; to: ViewRoute }

const KNOWN_PATHS = new Set<AppPath>([
  '/',
  '/login',
  '/signup',
  '/onboarding',
  '/today',
  '/dashboard',
])

function normalizePath(pathname: string): AppPath {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return KNOWN_PATHS.has(normalized as AppPath) ? (normalized as AppPath) : '/'
}

function authenticatedHome(user: RouteUser): ViewRoute {
  return user.onboardingCompleted ? '/today' : '/onboarding'
}

export function resolveRoute(
  pathname: string,
  user: RouteUser | null,
): RouteDecision {
  const path = normalizePath(pathname)

  if (path === '/') {
    return { kind: 'redirect', to: user ? authenticatedHome(user) : '/login' }
  }

  if (path === '/login' || path === '/signup') {
    return user
      ? { kind: 'redirect', to: authenticatedHome(user) }
      : { kind: 'view', route: path }
  }

  if (path === '/onboarding') {
    return user
      ? { kind: 'view', route: path }
      : { kind: 'redirect', to: '/login' }
  }

  if (!user) return { kind: 'redirect', to: '/login' }
  if (!user.onboardingCompleted) {
    return { kind: 'redirect', to: '/onboarding' }
  }
  return { kind: 'view', route: path }
}

interface NavigateOptions {
  replace?: boolean
}

export function useAppNavigation() {
  const [pathname, setPathname] = useState(() => window.location.pathname)

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = useCallback((to: AppPath, options: NavigateOptions = {}) => {
    if (window.location.pathname === to) return
    const method = options.replace ? 'replaceState' : 'pushState'
    window.history[method](null, '', to)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, [])

  return { pathname, navigate }
}
