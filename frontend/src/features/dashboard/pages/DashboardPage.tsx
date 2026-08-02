import { AppLink } from '../../../app/components/AppLink'
import { AppShell } from '../../../app/components/AppShell'

export function DashboardPage() {
  return (
    <AppShell>
      <main className="page-container route-placeholder">
        <section className="route-intro">
          <p className="eyebrow">Dashboard · 오늘의 흐름</p>
          <h1>작은 행동이 쌓이는 모습을 확인해요</h1>
          <p>
            완료한 여정과 더 작게 바꾼 기록, 바로 이어갈 다음 행동이 이곳에
            정리돼요.
          </p>
        </section>
        <section className="surface-card empty-feature" aria-labelledby="dashboard-empty-title">
          <span className="empty-icon" aria-hidden="true">
            0
          </span>
          <div>
            <p className="eyebrow">아직 기록이 없어요</p>
            <h2 id="dashboard-empty-title">첫 퀘스트부터 가볍게 시작해요</h2>
            <p>오늘의 행동을 시작하면 여정의 변화가 여기에 차곡차곡 보여요.</p>
          </div>
          <AppLink className="button button-primary" to="/today">
            오늘의 퀘스트로 이동
          </AppLink>
        </section>
      </main>
    </AppShell>
  )
}
