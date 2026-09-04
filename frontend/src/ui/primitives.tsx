import type { PropsWithChildren, ReactNode } from 'react';

interface AppShellProps extends PropsWithChildren {
  currentPage: '지금' | '기록' | '데이터 관리';
}

export function AppShell({ currentPage, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        본문으로 건너뛰기
      </a>
      <header className="site-header">
        <div className="shell-width brand-row">
          <a className="brand" href="#now" aria-label="Re:Start Quest 지금 화면">
            <span className="brand-mark" aria-hidden="true">R:</span>
            <span>Re:Start Quest</span>
          </a>
          <p className="brand-note">다시 시작할 수 있을 만큼 작게</p>
        </div>
      </header>
      <nav className="global-nav" aria-label="주요 화면">
        <div className="shell-width nav-list">
          {(['지금', '기록', '데이터 관리'] as const).map((page) => (
            <a
              key={page}
              href={page === '지금' ? '#now' : page === '기록' ? '#history' : '#data'}
              aria-current={currentPage === page ? 'page' : undefined}
            >
              {page}
            </a>
          ))}
        </div>
      </nav>
      <main className="shell-width main-content" id="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}

interface PageIntroProps {
  eyebrow?: string;
  title: string;
  description?: string;
  trailing?: ReactNode;
}

export function PageIntro({ eyebrow, title, description, trailing }: PageIntroProps) {
  return (
    <header className="page-intro">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="lede">{description}</p> : null}
      </div>
      {trailing}
    </header>
  );
}

interface StatePanelProps {
  kind: 'loading' | 'empty' | 'error';
  title: string;
  description: string;
  action?: ReactNode;
}

export function StatePanel({ kind, title, description, action }: StatePanelProps) {
  const symbol = kind === 'loading' ? '…' : kind === 'empty' ? '○' : '!';
  return (
    <section
      className={`state-panel state-panel--${kind}`}
      aria-live={kind === 'loading' ? 'polite' : undefined}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <span className="state-symbol" aria-hidden="true">{symbol}</span>
      <h1>{title}</h1>
      <p>{description}</p>
      {action ? <div className="state-action">{action}</div> : null}
    </section>
  );
}

export function StatusLabel({ kind }: { kind: 'DONE' | 'BLOCKED' | 'READY' }) {
  const labels = {
    DONE: ['✓', '완료'],
    BLOCKED: ['↘', '막힘'],
    READY: ['→', '진행 가능'],
  } as const;
  const [symbol, label] = labels[kind];

  return (
    <span className={`status-label status-label--${kind.toLowerCase()}`} aria-label={`상태: ${label}`}>
      <span aria-hidden="true">{symbol}</span>
      {label}
    </span>
  );
}

export function InlineError({ id, children }: PropsWithChildren<{ id?: string }>) {
  return (
    <p className="inline-error" id={id} role="alert">
      <span aria-hidden="true">!</span> {children}
    </p>
  );
}
