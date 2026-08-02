import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { TodayDashboardResponse, TodayDashboardState } from '../types'
import { DashboardContent } from './DashboardContent'

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    location: { pathname: '/dashboard' },
    history: { pushState() {}, replaceState() {} },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
  },
})

const retry = () => undefined

const partialDashboard: TodayDashboardResponse = {
  date: '2026-08-03',
  totalJourneys: 3,
  completedJourneys: [
    {
      journeyId: 'journey-2',
      questId: 'quest-2',
      title: '두 번째로 완료한 여정',
      category: 'JOB_SEARCH',
      estimatedMinutes: 10,
      completedAt: '2026-08-03T10:10:00+09:00',
    },
    {
      journeyId: 'journey-1',
      questId: 'quest-1',
      title: '첫 번째로 완료한 여정',
      category: 'RESUME',
      estimatedMinutes: 15,
      completedAt: '2026-08-03T09:10:00+09:00',
    },
  ],
  activeJourneys: [
    {
      journeyId: 'journey-3',
      questId: 'quest-3',
      title: '이어서 할 작은 행동',
      category: 'INTERVIEW',
      estimatedMinutes: 10,
    },
  ],
  redesignCount: 2,
  progressPercent: 67,
  nextQuest: {
    journeyId: 'journey-3',
    questId: 'quest-3',
    title: '이어서 할 작은 행동',
    category: 'INTERVIEW',
    estimatedMinutes: 10,
  },
  recentRedesigns: [
    {
      redesignId: 'redesign-2',
      journeyId: 'journey-3',
      originalQuestTitle: '두 번째 원래 행동',
      replacementQuestTitle: '두 번째로 바꾼 행동',
      reasonCode: 'TIME_SHORTAGE',
      createdAt: '2026-08-03T11:10:00+09:00',
    },
    {
      redesignId: 'redesign-1',
      journeyId: 'journey-2',
      originalQuestTitle: '첫 번째 원래 행동',
      replacementQuestTitle: '첫 번째로 바꾼 행동',
      reasonCode: 'START_POINT_UNCLEAR',
      createdAt: '2026-08-03T10:00:00+09:00',
    },
  ],
}

function render(state: TodayDashboardState): string {
  return renderToStaticMarkup(<DashboardContent state={state} onRetry={retry} />)
}

test('loading 상태는 접근 가능한 이름과 keyboard focus를 제공한다', () => {
  const markup = render({ status: 'loading', data: null, error: null })

  assert.match(markup, /role="status"/)
  assert.match(markup, /aria-label="오늘 진행을 불러오는 중"/)
  assert.match(markup, /tabindex="0"/)
})

test('empty 상태는 분석 UI 대신 오늘 퀘스트 만들기로 연결한다', () => {
  const markup = render({
    status: 'success',
    error: null,
    data: {
      date: '2026-08-03',
      totalJourneys: 0,
      completedJourneys: [],
      activeJourneys: [],
      redesignCount: 0,
      progressPercent: 0,
      nextQuest: null,
      recentRedesigns: [],
    },
  })

  assert.match(markup, /오늘 퀘스트 만들기/)
  assert.match(markup, /href="\/today"/)
  assert.doesNotMatch(markup, /<progress/)
})

test('partial 상태는 진행 정보와 canonical 배열 순서를 그대로 보여준다', () => {
  const markup = render({ status: 'success', data: partialDashboard, error: null })

  assert.match(markup, /오늘 3개 중 2개 여정을 마쳤어요/)
  assert.match(markup, /오늘 여정 진행 67%/)
  assert.match(markup, /이어서 할 작은 행동/)
  assert.ok(
    markup.indexOf('두 번째로 완료한 여정') <
      markup.indexOf('첫 번째로 완료한 여정'),
  )
  assert.ok(
    markup.indexOf('두 번째로 바꾼 행동') <
      markup.indexOf('첫 번째로 바꾼 행동'),
  )
})

test('completed 상태는 완료 안내와 focus 가능한 다음 링크를 보여준다', () => {
  const completed: TodayDashboardResponse = {
    ...partialDashboard,
    completedJourneys: [
      ...partialDashboard.completedJourneys,
      {
        journeyId: 'journey-3',
        questId: 'quest-3',
        title: '세 번째로 완료한 여정',
        category: 'INTERVIEW',
        estimatedMinutes: 10,
        completedAt: '2026-08-03T12:10:00+09:00',
      },
    ],
    activeJourneys: [],
    progressPercent: 100,
    nextQuest: null,
  }
  const markup = render({ status: 'success', data: completed, error: null })

  assert.match(markup, /오늘 계획한 여정을 모두 마쳤어요/)
  assert.match(markup, /오늘의 퀘스트 확인하기/)
  assert.match(markup, /href="\/today"/)
})

test('error 상태는 안전한 안내와 keyboard retry를 제공한다', () => {
  const markup = render({
    status: 'error',
    data: null,
    error: '잠시 후 다시 시도해 주세요.',
  })

  assert.match(markup, /role="alert"/)
  assert.match(markup, /<button[^>]*>다시 불러오기<\/button>/)
  assert.doesNotMatch(markup, /token|stack|trace/i)
})

test('대시보드 상태에는 사용자 평가나 비교 표현이 없다', () => {
  const markup = render({ status: 'success', data: partialDashboard, error: null })

  assert.doesNotMatch(markup, /실패율|의지 점수|위험|낙오|사용자 비교/)
})
