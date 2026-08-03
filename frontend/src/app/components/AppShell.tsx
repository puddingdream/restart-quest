import type { ReactNode } from 'react'
import { useAuth } from '../../features/auth/AuthContext'
import { AppLink } from './AppLink'
import { Brand } from './Brand'

export function AppShell({ children }: { children: ReactNode }) {
  const { logout } = useAuth()

  return (
    <div className="app-shell">
      <header className="app-header">
        <Brand />
        <nav aria-label="주요 메뉴">
          <AppLink to="/today">오늘의 퀘스트</AppLink>
          <AppLink to="/dashboard">대시보드</AppLink>
          <button className="text-button" onClick={() => void logout()}>
            로그아웃
          </button>
        </nav>
      </header>
      {children}
    </div>
  )
}
