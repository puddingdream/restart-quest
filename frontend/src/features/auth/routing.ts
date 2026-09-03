import { useSyncExternalStore } from 'react'

const navigationEvent = 'restart-quest:navigate'

function locationSnapshot(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

function subscribe(listener: () => void): () => void {
  window.addEventListener('popstate', listener)
  window.addEventListener(navigationEvent, listener)
  return () => {
    window.removeEventListener('popstate', listener)
    window.removeEventListener(navigationEvent, listener)
  }
}

export function useLocationPath(): string {
  return useSyncExternalStore(subscribe, locationSnapshot, () => '/')
}

export function navigate(to: string, options: { replace?: boolean } = {}): void {
  if (options.replace) {
    window.history.replaceState(null, '', to)
  } else {
    window.history.pushState(null, '', to)
  }

  window.dispatchEvent(new Event(navigationEvent))
}

export function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/account'
  }

  const url = new URL(value, window.location.origin)
  if (url.origin !== window.location.origin || ['/login', '/register'].includes(url.pathname)) {
    return '/account'
  }

  return `${url.pathname}${url.search}${url.hash}`
}

export function loginPathFor(returnTo: string): string {
  return `/login?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`
}
