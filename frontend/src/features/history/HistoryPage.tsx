import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/Button'
import { LoadingIndicator } from '../../components/LoadingIndicator'
import { StatusNotice } from '../../components/StatusNotice'
import { ApiError } from '../../lib/api/ApiClient'
import {
  queryClient as defaultQueryClient,
  type QueryClient,
} from '../../lib/query/QueryClient'
import { RouteLink } from '../today/RouteLink'
import type { Barrier, CheckIn, FocusArea } from '../today/contracts'
import type { HistoryDay, HistoryView } from './contracts'
import { historyApi as defaultHistoryApi, type HistoryApi } from './historyApi'

const focusLabels: Record<FocusArea, string> = {
  EXPLORE: '직무 탐색',
  RESUME: '이력서',
  APPLY: '지원 준비',
  INTERVIEW: '면접 연습',
}

const barrierLabels: Record<Barrier, string> = {
  TOO_LARGE: '행동이 너무 크게 느껴짐',
  NO_TIME: '시간 부족',
  LOW_ENERGY: '에너지 부족',
  UNCLEAR: '방법이 불분명함',
  EMOTIONAL_LOAD: '마음의 부담',
  OTHER: '다른 이유',
}

function seoulDateParts(date = new Date()): { from: string; to: string } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Seoul',
    year: 'numeric',
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map(({ type, value }) => [type, value]),
  )
  const to = `${parts.year}-${parts.month}-${parts.day}`
  const toDate = new Date(`${to}T00:00:00+09:00`)
  toDate.setUTCDate(toDate.getUTCDate() - 13)
  const from = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Seoul',
    year: 'numeric',
  })
    .formatToParts(toDate)
    .reduce<Record<string, string>>((result, part) => {
      result[part.type] = part.value
      return result
    }, {})

  return { from: `${from.year}-${from.month}-${from.day}`, to }
}

function messageFor(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : '기록을 불러오지 못했습니다. 다시 시도해 주세요.'
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Seoul',
    weekday: 'short',
  }).format(new Date(`${value}T00:00:00+09:00`))
}

function checkInSummary(checkIn: CheckIn): string {
  return `${focusLabels[checkIn.focusArea]} · ${checkIn.availableMinutes}분 · 에너지 ${
    checkIn.energyLevel === 'LOW' ? '낮음' : checkIn.energyLevel === 'MEDIUM' ? '보통' : '충분'
  }`
}

function HistoryDayItem({ day }: { day: HistoryDay }) {
  return (
    <li className="history-day">
      <header>
        <h2>{formatDate(day.date)}</h2>
        <p>{checkInSummary(day.checkIn)}</p>
      </header>
      {day.outcomes.length > 0 ? (
        <ol className="outcome-list">
          {day.outcomes.map((outcome) => (
            <li className={`outcome outcome--${outcome.type.toLowerCase()}`} key={outcome.quest.id}>
              <span className="outcome__marker" aria-hidden="true">
                {outcome.type === 'COMPLETED' ? '✓' : '↘'}
              </span>
              <div>
                <p className="outcome__type">
                  {outcome.type === 'COMPLETED' ? '완료' : '더 작게 재시도'}
                </p>
                <h3>{outcome.quest.title}</h3>
                <p>
                  {outcome.quest.estimatedMinutes}분 · 난이도 {outcome.quest.difficulty}단계
                </p>
                {outcome.type === 'BLOCKED' && outcome.barrier ? (
                  <p>막힌 이유: {barrierLabels[outcome.barrier]}</p>
                ) : null}
                {outcome.note ? <p className="outcome__note">내 메모: {outcome.note}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="history-day__pending">체크인 후 아직 행동 결과를 기록하지 않았어요.</p>
      )}
    </li>
  )
}

export function HistoryPage({
  accountId = 'current',
  api = defaultHistoryApi,
  queryClient = defaultQueryClient,
}: {
  accountId?: string
  api?: HistoryApi
  queryClient?: QueryClient
}) {
  const range = useMemo(() => seoulDateParts(), [])
  const queryKey = `quest.history:${accountId}:${range.from}:${range.to}`
  const [view, setView] = useState<HistoryView | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadHistory = useCallback(
    async (force = false) => {
      setError(null)
      if (force) {
        queryClient.invalidate(queryKey)
      }
      try {
        const history = await queryClient.fetchQuery(queryKey, () =>
          api.history(range.from, range.to),
        )
        setView(history)
      } catch (caught) {
        setError(messageFor(caught))
      }
    },
    [api, queryClient, queryKey, range.from, range.to],
  )

  useEffect(() => {
    queueMicrotask(() => void loadHistory(true))
  }, [loadHistory])

  if (!view && !error) {
    return (
      <section className="quest-page" aria-label="최근 기록">
        <LoadingIndicator label="최근 14일 기록을 불러오는 중" />
      </section>
    )
  }

  if (!view && error) {
    return (
      <section className="quest-page">
        <StatusNotice tone="error" title="최근 기록을 불러오지 못했어요" description={error} />
        <Button type="button" onClick={() => void loadHistory(true)}>
          기록 다시 불러오기
        </Button>
      </section>
    )
  }

  if (!view) {
    return null
  }

  const sortedDays = [...view.days].sort((left, right) => right.date.localeCompare(left.date))

  return (
    <section className="quest-page history-page" aria-labelledby="history-title">
      <header className="page-heading">
        <p className="eyebrow">최근 14일</p>
        <h1 id="history-title">다시 시작한 기록</h1>
        <p>완료뿐 아니라 부담을 줄여 다시 시도한 과정도 같은 기록이에요.</p>
      </header>
      {sortedDays.length === 0 ? (
        <div className="empty-state">
          <h2>아직 기록이 없어요</h2>
          <p>오늘 가능한 만큼을 고르면 첫 번째 기록이 시작됩니다.</p>
          <RouteLink className="button button--primary" to="/today">
            오늘로 이동하기
          </RouteLink>
        </div>
      ) : (
        <ol className="history-list">
          {sortedDays.map((day) => (
            <HistoryDayItem day={day} key={day.date} />
          ))}
        </ol>
      )}
    </section>
  )
}
