import type { MouseEvent, ReactNode } from 'react'
import { navigate } from '../auth/routing'

export function RouteLink({
  ariaCurrent,
  children,
  className,
  to,
}: {
  ariaCurrent?: 'page'
  children: ReactNode
  className?: string
  to: string
}) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }

    event.preventDefault()
    navigate(to)
  }

  return (
    <a aria-current={ariaCurrent} className={className} href={to} onClick={handleClick}>
      {children}
    </a>
  )
}
