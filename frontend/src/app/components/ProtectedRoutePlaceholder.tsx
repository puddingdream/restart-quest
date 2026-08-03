import { useAuth } from '../../features/auth/AuthContext'
import { AppLink } from './AppLink'
import { AppShell } from './AppShell'

type PlaceholderRoute = 'today' | 'dashboard'

export function ProtectedRoutePlaceholder({
  route,
}: {
  route: PlaceholderRoute
}) {
  const { user } = useAuth()
  const isToday = route === 'today'

  return (
    <AppShell>
      <main className="page-container route-placeholder">
        <section className="route-intro">
          <p className="eyebrow">
            {isToday ? 'Today · 작은 행동부터' : 'Dashboard · 오늘의 흐름'}
          </p>
          <h1>
            {isToday
              ? `${user?.name}님, 오늘의 퀘스트를 시작해볼까요?`
              : '작은 행동이 쌓이는 모습을 확인해요'}
          </h1>
          <p>
            {isToday
              ? '준비 상태가 저장되었어요. 오늘 가능한 에너지를 고르면 세 개의 작은 구직 행동을 만날 수 있어요.'
              : '완료한 여정과 더 작게 바꾼 기록, 바로 이어갈 다음 행동이 이곳에 정리돼요.'}
          </p>
        </section>
        <section
          className="surface-card empty-feature"
          aria-labelledby={`${route}-placeholder-title`}
        >
          <span className="empty-icon" aria-hidden="true">
            {isToday ? '↗' : '0'}
          </span>
          <div>
            <p className="eyebrow">
              {isToday ? '다음 행동' : '아직 기록이 없어요'}
            </p>
            <h2 id={`${route}-placeholder-title`}>
              {isToday
                ? '오늘의 퀘스트를 준비하고 있어요'
                : '첫 퀘스트부터 가볍게 시작해요'}
            </h2>
            <p>
              {isToday
                ? '퀘스트 생성 화면이 연결되면 이 자리에서 오늘의 에너지에 맞는 행동을 선택할 수 있어요.'
                : '오늘의 행동을 시작하면 여정의 변화가 여기에 차곡차곡 보여요.'}
            </p>
          </div>
          <AppLink
            className={`button ${isToday ? 'button-secondary' : 'button-primary'}`}
            to={isToday ? '/onboarding' : '/today'}
          >
            {isToday ? '시작점 다시 확인하기' : '오늘의 퀘스트로 이동'}
          </AppLink>
        </section>
      </main>
    </AppShell>
  )
}
