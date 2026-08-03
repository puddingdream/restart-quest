import { AppLink } from '../../../app/components/AppLink'
import {
  DASHBOARD_CATEGORY_LABELS,
  REDESIGN_REASON_LABELS,
  type TodayDashboardResponse,
} from '../types'
import { DashboardHeading } from './DashboardStates'

function formatDate(date: string): string {
  const [year, month, day] = date.split('-')
  return year && month && day ? `${year}년 ${Number(month)}월 ${Number(day)}일` : date
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Seoul',
  }).format(date)
}

function ProgressSummary({ data }: { data: TodayDashboardResponse }) {
  return (
    <section className="surface-card dashboard-summary" aria-labelledby="progress-title">
      <div className="dashboard-summary-heading">
        <div>
          <p className="eyebrow">{formatDate(data.date)}</p>
          <h2 id="progress-title">오늘의 진행</h2>
        </div>
        <strong aria-hidden="true">{data.progressPercent}%</strong>
      </div>
      <progress
        aria-label={`오늘 여정 진행 ${data.progressPercent}%`}
        max="100"
        value={data.progressPercent}
      >
        {data.progressPercent}%
      </progress>
      <dl className="dashboard-counts">
        <div>
          <dt>전체 여정</dt>
          <dd>{data.totalJourneys}</dd>
        </div>
        <div>
          <dt>마친 여정</dt>
          <dd>{data.completedJourneys.length}</dd>
        </div>
        <div>
          <dt>다시 설계한 기록</dt>
          <dd>{data.redesignCount}</dd>
        </div>
      </dl>
    </section>
  )
}

function NextQuest({ data }: { data: TodayDashboardResponse }) {
  const quest = data.nextQuest
  const isCompleted = data.completedJourneys.length === data.totalJourneys

  return (
    <section className="surface-card dashboard-next" aria-labelledby="next-quest-title">
      <p className="eyebrow">바로 이어가기</p>
      {quest ? (
        <>
          <span className="dashboard-category">
            {DASHBOARD_CATEGORY_LABELS[quest.category]}
          </span>
          <h2 id="next-quest-title">{quest.title}</h2>
          <p>{quest.estimatedMinutes}분 정도의 작은 행동이에요.</p>
          <AppLink className="button button-primary" to="/today">
            이 퀘스트 이어가기
          </AppLink>
        </>
      ) : (
        <>
          <h2 id="next-quest-title">
            {isCompleted ? '오늘 계획한 여정을 모두 마쳤어요' : '다음 행동을 정리하고 있어요'}
          </h2>
          <p>
            {isCompleted
              ? '완료한 기록을 천천히 돌아보거나 오늘의 퀘스트를 다시 확인해요.'
              : '오늘의 퀘스트에서 현재 행동을 확인해 주세요.'}
          </p>
          <AppLink className="button button-secondary" to="/today">
            오늘의 퀘스트 확인하기
          </AppLink>
        </>
      )}
    </section>
  )
}

function CompletedJourneys({ data }: { data: TodayDashboardResponse }) {
  return (
    <section className="dashboard-list-section" aria-labelledby="completed-title">
      <div className="dashboard-section-heading">
        <div>
          <p className="eyebrow">완료한 여정</p>
          <h2 id="completed-title">오늘 남긴 발걸음</h2>
        </div>
        <span>{data.completedJourneys.length}개</span>
      </div>
      {data.completedJourneys.length > 0 ? (
        <ol className="dashboard-record-list">
          {data.completedJourneys.map((journey) => (
            <li key={journey.journeyId}>
              <article>
                <div>
                  <span className="dashboard-category">
                    {DASHBOARD_CATEGORY_LABELS[journey.category]}
                  </span>
                  <h3>{journey.title}</h3>
                </div>
                <time dateTime={journey.completedAt}>
                  {formatTime(journey.completedAt)} 완료
                </time>
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <p className="dashboard-list-empty">첫 여정을 마치면 이곳에 기록돼요.</p>
      )}
    </section>
  )
}

function RedesignRecords({ data }: { data: TodayDashboardResponse }) {
  return (
    <section className="dashboard-list-section" aria-labelledby="redesign-title">
      <div className="dashboard-section-heading">
        <div>
          <p className="eyebrow">다시 설계한 기록</p>
          <h2 id="redesign-title">더 작은 행동으로 바꾼 과정</h2>
        </div>
        <span>{data.redesignCount}개</span>
      </div>
      {data.recentRedesigns.length > 0 ? (
        <ol className="dashboard-record-list redesign-record-list">
          {data.recentRedesigns.map((record) => (
            <li key={record.redesignId}>
              <article>
                <p>{REDESIGN_REASON_LABELS[record.reasonCode]}</p>
                <h3>{record.replacementQuestTitle}</h3>
                <p className="dashboard-previous-quest">
                  이전 행동: {record.originalQuestTitle}
                </p>
                <time dateTime={record.createdAt}>{formatTime(record.createdAt)}</time>
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <p className="dashboard-list-empty">
          오늘은 다시 설계한 기록 없이 진행하고 있어요.
        </p>
      )}
    </section>
  )
}

export function DashboardOverview({ data }: { data: TodayDashboardResponse }) {
  return (
    <>
      <DashboardHeading data={data} />
      <div className="dashboard-top-grid">
        <ProgressSummary data={data} />
        <NextQuest data={data} />
      </div>
      <div className="dashboard-history-grid">
        <CompletedJourneys data={data} />
        <RedesignRecords data={data} />
      </div>
    </>
  )
}
