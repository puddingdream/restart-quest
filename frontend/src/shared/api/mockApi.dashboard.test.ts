import assert from 'node:assert/strict'
import test from 'node:test'
import type { AuthResponse } from '../../features/auth/types'
import type { TodayDashboardResponse } from '../../features/dashboard/types'
import { ApiError } from './ApiError'
import { clearMockSession, mockRequest } from './mockApi'

class MemoryStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }

  removeItem(key: string) {
    this.values.delete(key)
  }
}

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    sessionStorage: new MemoryStorage(),
    setTimeout,
    location: { pathname: '/dashboard' },
    history: { pushState() {}, replaceState() {} },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
  },
})

test('canonical dashboard mock은 생성 전 empty 응답을 제공한다', async () => {
  clearMockSession()
  const auth = await mockRequest<AuthResponse>('/auth/signup', {
    method: 'POST',
    body: { email: 'new@example.com', name: '새 사용자' },
    accessToken: null,
  })
  const dashboard = await mockRequest<TodayDashboardResponse>(
    '/dashboard/today',
    { method: 'GET', accessToken: auth.accessToken },
  )

  assert.equal(dashboard.totalJourneys, 0)
  assert.equal(dashboard.completedJourneys.length, 0)
  assert.equal(dashboard.nextQuest, null)
  assert.deepEqual(dashboard.recentRedesigns, [])
})

test('canonical dashboard mock은 진행, 다음 행동과 기록 순서를 함께 반환한다', async () => {
  clearMockSession()
  const auth = await mockRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email: 'ready@example.com' },
    accessToken: null,
  })
  const dashboard = await mockRequest<TodayDashboardResponse>(
    '/dashboard/today',
    { method: 'GET', accessToken: auth.accessToken },
  )

  assert.equal(dashboard.totalJourneys, 3)
  assert.equal(dashboard.completedJourneys.length, 1)
  assert.equal(dashboard.activeJourneys.length, 2)
  assert.equal(dashboard.progressPercent, 33)
  assert.equal(dashboard.redesignCount, 1)
  assert.equal(dashboard.nextQuest?.journeyId, dashboard.activeJourneys[0]?.journeyId)
  assert.equal(
    dashboard.recentRedesigns[0]?.replacementQuestTitle,
    dashboard.nextQuest?.title,
  )
})

test('canonical dashboard mock의 기록 시각은 새벽에도 서울 당일 현재 이전이다', async () => {
  clearMockSession()
  const auth = await mockRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email: 'ready@example.com' },
    accessToken: null,
  })
  const now = new Date('2026-08-03T00:05:00+09:00')
  const dashboard = await mockRequest<TodayDashboardResponse>(
    '/dashboard/today',
    { method: 'GET', accessToken: auth.accessToken, now },
  )
  const dayStartedAt = Date.parse(`${dashboard.date}T00:00:00+09:00`)
  const completedAt = Date.parse(dashboard.completedJourneys[0]?.completedAt ?? '')
  const redesignedAt = Date.parse(dashboard.recentRedesigns[0]?.createdAt ?? '')

  assert.equal(dashboard.date, '2026-08-03')
  assert.ok(completedAt >= dayStartedAt)
  assert.ok(redesignedAt >= completedAt)
  assert.ok(redesignedAt <= now.getTime())
})

test('canonical dashboard mock은 인증되지 않은 조회를 구분한다', async () => {
  clearMockSession()

  await assert.rejects(
    mockRequest('/dashboard/today', { method: 'GET', accessToken: null }),
    (error: unknown) =>
      error instanceof ApiError && error.code === 'SESSION_EXPIRED',
  )
})
