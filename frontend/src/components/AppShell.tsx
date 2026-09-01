import type { PropsWithChildren } from 'react'
import { Link } from 'react-router-dom'

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">본문으로 바로가기</a>
      <header className="site-header">
        <div className="site-header__inner">
          <Link className="brand" to="/" aria-label="Re:Start Quest 처음 화면">
            <span className="brand__mark" aria-hidden="true">R:</span>
            <span>Re:Start Quest</span>
          </Link>
          <p className="site-header__note">오늘을 다시 잇는 작은 행동</p>
        </div>
      </header>
      <main id="main-content" className="page-content" tabIndex={-1}>{children}</main>
      <footer className="site-footer">
        <p>결과를 재촉하지 않고, 다시 시작할 수 있는 크기를 함께 찾습니다.</p>
      </footer>
    </div>
  )
}
