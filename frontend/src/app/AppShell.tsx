import type { ReactNode } from 'react'

type AppShellProps = {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        본문으로 건너뛰기
      </a>
      <header className="site-header">
        <div className="site-header__inner">
          <a className="brand" href="/" aria-label="Re:Start Quest 홈">
            <span className="brand__mark" aria-hidden="true">
              R:
            </span>
            <span>Re:Start Quest</span>
          </a>
          <p className="site-header__tagline">한 번에 작은 행동 하나</p>
        </div>
      </header>
      <main className="app-main" id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer">
        <p>
          Re:Start Quest는 구직 행동 정리 도구이며 전문 상담이나 의료 서비스를
          대신하지 않습니다.
        </p>
      </footer>
    </div>
  )
}
