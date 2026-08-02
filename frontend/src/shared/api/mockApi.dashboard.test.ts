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
  assert.equal(dashboard.completedJourneys, 0)
  assert.equal(dashboard.activeJourneys, 0)
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
  assert.equal(dashboard.completedJourneys, 1)
  assert.equal(dashboard.activeJourneys, 2)
  assert.equal(dashboard.progressPercent, 33)
  assert.equal(dashboard.redesignCount, 1)
  assert.equal(dashboard.nextQuest?.journeyId, `${dashboard.date}-journey-2`)
  assert.equal(
    dashboard.recentRedesigns[0]?.replacementQuestTitle,
    dashboard.nextQuest?.title,
  )
})

test('canonical dashboard mock은 인증되지 않은 조회를 구분한다', async () => {
  clearMockSession()

  await assert.rejects(
    mockRequest('/dashboard/today', { method: 'GET', accessToken: null }),
    (error: unknown) =>
      error instanceof ApiError && error.code === 'SESSION_EXPIRED',
  )
})
