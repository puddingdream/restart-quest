import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError } from '../../../shared/api/ApiError'
import type { TodayDashboardResponse } from '../types'
import { loadTodayDashboard } from './loadTodayDashboard'

const emptyDashboard: TodayDashboardResponse = {
  date: '2026-08-03',
  totalJourneys: 0,
  completedJourneys: [],
  activeJourneys: [],
  redesignCount: 0,
  progressPercent: 0,
  nextQuest: null,
  recentRedesigns: [],
}

test('대시보드 조회 성공 결과를 그대로 상태로 변환한다', async () => {
  const result = await loadTodayDashboard(async () => emptyDashboard)

  assert.deepEqual(result, {
    status: 'success',
    data: emptyDashboard,
    error: null,
  })
})

test('401 응답은 재시도 오류 대신 세션 만료로 분류한다', async () => {
  const result = await loadTodayDashboard(async () => {
    throw new ApiError(401, 'SESSION_EXPIRED', 'expired')
  })

  assert.deepEqual(result, { status: 'session-expired' })
})

test('401이 아닌 오류는 안전한 재시도 상태로 남긴다', async () => {
  const result = await loadTodayDashboard(async () => {
    throw new ApiError(503, 'PROVIDER_TIMEOUT', 'provider details')
  })

  assert.deepEqual(result, {
    status: 'error',
    data: null,
    error: '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  })
})
