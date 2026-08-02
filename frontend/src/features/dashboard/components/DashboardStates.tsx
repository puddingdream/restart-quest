import { AppLink } from '../../../app/components/AppLink'
import type { TodayDashboardResponse } from '../types'

function formatDate(date: string): string {
  const [year, month, day] = date.split('-')
  return year && month && day ? `${year}년 ${Number(month)}월 ${Number(day)}일` : date
}

export function DashboardHeading({ data }: { data?: TodayDashboardResponse }) {
  const completedCount = data?.completedJourneys ?? 0
  const totalCount = data?.totalJourneys ?? 0

  return (
    <header className="dashboard-heading">
      <p className="eyebrow">Dashboard · 오늘의 흐름</p>
      <h1 id="dashboard-title">
        {data
          ? `오늘 ${totalCount}개 중 ${completedCount}개 여정을 마쳤어요`
          : '오늘 이어갈 작은 행동을 확인해요'}
      </h1>
      <p>
        완료한 여정과 다시 설계한 기록을 돌아보고, 바로 이어갈 다음 행동을
        확인해요.
      </p>
    </header>
  )
}

export function DashboardLoading() {
  return (
    <>
      <DashboardHeading />
      <section
        className="surface-card dashboard-state dashboard-loading"
        role="status"
        aria-label="오늘 진행을 불러오는 중"
        tabIndex={0}
      >
        <span className="dashboard-loader" aria-hidden="true" />
        <div>
          <h2>오늘의 흐름을 정리하고 있어요</h2>
          <p>잠시만 기다리면 다음 행동을 확인할 수 있어요.</p>
        </div>
      </section>
    </>
  )
}

export function DashboardEmpty({ date }: { date: string }) {
  return (
    <>
      <DashboardHeading />
      <section
        className="surface-card dashboard-state dashboard-empty"
        aria-labelledby="dashboard-empty-title"
      >
        <span className="dashboard-state-icon" aria-hidden="true">
          ↗
        </span>
        <div>
          <p className="eyebrow">{formatDate(date)} · 시작 전</p>
          <h2 id="dashboard-empty-title">오늘의 퀘스트를 먼저 만들어볼까요?</h2>
          <p>세 개의 작은 행동을 만들면 오늘의 진행이 이곳에 나타나요.</p>
        </div>
        <AppLink className="button button-primary" to="/today">
          오늘 퀘스트 만들기
        </AppLink>
      </section>
    </>
  )
}

export function DashboardError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <>
      <DashboardHeading />
      <section
        className="surface-card dashboard-state dashboard-error"
        role="alert"
        aria-labelledby="dashboard-error-title"
        tabIndex={-1}
      >
        <span className="dashboard-state-icon" aria-hidden="true">
          !
        </span>
        <div>
          <h2 id="dashboard-error-title">오늘의 진행을 불러오지 못했어요</h2>
          <p>{message}</p>
        </div>
        <button className="button button-primary" type="button" onClick={onRetry}>
          다시 불러오기
        </button>
      </section>
    </>
  )
}
