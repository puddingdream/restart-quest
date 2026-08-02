import { AppLink } from '../../../app/components/AppLink'
import { AppShell } from '../../../app/components/AppShell'
import { useAuth } from '../../auth/AuthContext'

export function TodayPage() {
  const { user } = useAuth()

  return (
    <AppShell>
      <main className="page-container route-placeholder">
        <section className="route-intro">
          <p className="eyebrow">Today · 작은 행동부터</p>
          <h1>{user?.name}님, 오늘의 퀘스트를 시작해볼까요?</h1>
          <p>
            준비 상태가 저장되었어요. 오늘 가능한 에너지를 고르면 세 개의 작은
            구직 행동을 만날 수 있어요.
          </p>
        </section>
        <section className="surface-card empty-feature" aria-labelledby="today-ready-title">
          <span className="empty-icon" aria-hidden="true">
            ↗
          </span>
          <div>
            <p className="eyebrow">다음 행동</p>
            <h2 id="today-ready-title">오늘의 퀘스트를 준비하고 있어요</h2>
            <p>
              퀘스트 생성 화면이 연결되면 이 자리에서 오늘의 에너지에 맞는 행동을
              선택할 수 있어요.
            </p>
          </div>
          <AppLink className="button button-secondary" to="/onboarding">
            시작점 다시 확인하기
          </AppLink>
        </section>
      </main>
    </AppShell>
  )
}
