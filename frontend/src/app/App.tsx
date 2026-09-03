import { AppShell } from './AppShell'
import { StatusNotice } from '../components/StatusNotice'

export function App() {
  return (
    <AppShell>
      <section className="hero" aria-labelledby="welcome-title">
        <p className="eyebrow">오늘의 재시작</p>
        <h1 id="welcome-title">막히면 더 작게, 오늘 다시 시작하기</h1>
        <p className="hero__description">
          지금 쓸 수 있는 시간과 에너지에 맞춰, 끝낼 수 있는 구직 행동 한 가지에
          집중해요.
        </p>
        <div className="hero__actions">
          <a className="button button--primary" href="#restart-guide">
            작게 시작하는 방법
          </a>
        </div>
      </section>

      <div id="restart-guide">
        <StatusNotice
          title="작은 시작도 기록할 수 있어요"
          description="완료하지 못해도 괜찮아요. 막힌 이유를 고르면 더 쉬운 다음 행동으로 이어집니다."
        />
      </div>
    </AppShell>
  )
}
