import { useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { Button } from '../../components/Button'

export function LandingPage() {
  const navigate = useNavigate()

  return (
    <AppShell>
      <section className="hero" aria-labelledby="landing-title">
        <p className="eyebrow">다시 시작하는 가장 작은 방법</p>
        <h1 id="landing-title">멈춘 준비를, 오늘 할 수 있는 한 가지로</h1>
        <p className="hero__description">
          긴 계획도 가입도 필요 없어요. 지금의 여력에 맞는 작은 행동을 하나 고르고,
          어렵다면 더 쉬운 행동으로 바꿔 보세요.
        </p>
        <div className="action-row">
          <Button onClick={() => navigate('/start')}>오늘의 작은 행동 만들기</Button>
        </div>
      </section>

      <section className="steps" aria-labelledby="steps-title">
        <div className="section-heading">
          <p className="eyebrow">이렇게 이어져요</p>
          <h2 id="steps-title">부담 대신 다음 행동에 집중해요</h2>
        </div>
        <ol className="step-list">
          <li>
            <span className="step-list__number" aria-hidden="true">01</span>
            <strong>지금의 여력을 선택해요</strong>
            <p>목표와 에너지, 가능한 시간만 짧게 확인해요.</p>
          </li>
          <li>
            <span className="step-list__number" aria-hidden="true">02</span>
            <strong>작은 행동 하나를 확인해요</strong>
            <p>끝냈는지 바로 알 수 있는 구체적인 행동만 보여 드려요.</p>
          </li>
          <li>
            <span className="step-list__number" aria-hidden="true">03</span>
            <strong>어렵다면 더 작게 바꿔요</strong>
            <p>멈춘 이유를 탓하지 않고 다음 시도를 가볍게 만들어요.</p>
          </li>
        </ol>
      </section>
    </AppShell>
  )
}
