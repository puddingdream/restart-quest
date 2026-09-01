import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { Button } from './components/Button'
import { Feedback } from './components/Feedback'

function LandingPage() {
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

function RoutePreview({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <AppShell>
      <section className="route-preview" aria-labelledby="preview-title">
        <p className="eyebrow">{eyebrow}</p>
        <h1 id="preview-title">{title}</h1>
        <p>{description}</p>
        <Feedback tone="info" title="화면 준비 중">
          실행 shell은 준비되었어요. 입력과 행동 데이터는 다음 기능 패키지에서 안전하게
          연결합니다.
        </Feedback>
        <Link className="text-link" to="/">처음 화면으로 돌아가기</Link>
      </section>
    </AppShell>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/start"
        element={
          <RoutePreview
            eyebrow="작은 행동 설정"
            title="오늘 가능한 만큼만 알려 주세요"
            description="목표, 에너지, 가능한 시간을 선택하는 짧은 설정 화면이 이곳에 연결됩니다."
          />
        }
      />
      <Route
        path="/quest"
        element={
          <RoutePreview
            eyebrow="오늘의 작은 행동"
            title="한 번에 한 가지에 집중해요"
            description="현재 행동과 완료 또는 재설계 흐름이 이곳에 연결됩니다."
          />
        }
      />
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  )
}
