import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError } from '../../../shared/api/ApiError'
import {
  authMockApi,
  clearAuthMockSession,
} from '../../auth/api/authMockApi'
import { onboardingMockApi } from '../../onboarding/api/onboardingMockApi'
import { clearQuestMockSession, questMockApi } from '../../quests/api/questMockApi'
import { questOutcomeMockApi } from '../../quests/api/questOutcomeMockApi'
import { dashboardMockApi } from './dashboardMockApi'

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

test('canonical feature mock은 생성 전 empty 응답을 제공한다', async () => {
  clearAuthMockSession()
  const auth = await authMockApi.signup({
    email: 'new@example.com',
    password: 'password123',
    name: '새 사용자',
  })
  const dashboard = await dashboardMockApi.getToday(auth.accessToken)

  assert.equal(dashboard.totalJourneys, 0)
  assert.equal(dashboard.completedJourneys, 0)
  assert.equal(dashboard.activeJourneys, 0)
  assert.equal(dashboard.nextQuest, null)
  assert.deepEqual(dashboard.recentRedesigns, [])
})

test('canonical feature mock은 진행, 다음 행동과 기록 순서를 함께 반환한다', async () => {
  clearAuthMockSession()
  const auth = await authMockApi.login({
    email: 'ready@example.com',
    password: 'password123',
  })
  const dashboard = await dashboardMockApi.getToday(auth.accessToken)

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

test('canonical feature mock은 인증되지 않은 조회를 구분한다', async () => {
  clearAuthMockSession()

  await assert.rejects(
    dashboardMockApi.getToday(null),
    (error: unknown) =>
      error instanceof ApiError && error.code === 'SESSION_EXPIRED',
  )
})

test('완료와 실패 후 재설계 기록을 실제 mock 대시보드 집계에 반영한다', async () => {
  clearAuthMockSession()
  clearQuestMockSession()
  const auth = await authMockApi.signup({
    email: 'dashboard-flow@example.com',
    password: 'password123',
    name: '대시보드 사용자',
  })
  await onboardingMockApi.upsert(
    {
      desiredJob: '백엔드 개발자',
      desiredWorkType: 'FULL_TIME',
      careerGapMonths: 8,
      hasResume: true,
      interviewExperience: 'LIMITED',
    },
    auth.accessToken,
  )
  const plan = await questMockApi.generate(
    { energyLevel: 'LOW' },
    auth.accessToken,
  )

  await questOutcomeMockApi.complete(
    plan.journeys[0].currentQuest.id,
    auth.accessToken,
  )
  const redesigned = await questOutcomeMockApi.redesign(
    plan.journeys[1].currentQuest.id,
    { reasonCode: 'TIME_SHORTAGE' },
    auth.accessToken,
  )

  assert.deepEqual(
    redesigned.journey.history.map(({ id }) => id),
    [plan.journeys[1].currentQuest.id],
  )
  assert.ok(
    !redesigned.journey.history.some(
      ({ id }) => id === redesigned.journey.currentQuest.id,
    ),
  )

  const dashboard = await dashboardMockApi.getToday(auth.accessToken)
  assert.equal(dashboard.totalJourneys, 3)
  assert.equal(dashboard.completedJourneys, 1)
  assert.equal(dashboard.activeJourneys, 2)
  assert.equal(dashboard.progressPercent, 33)
  assert.equal(dashboard.redesignCount, 1)
  assert.equal(dashboard.recentRedesigns[0]?.reasonCode, 'TIME_SHORTAGE')
  assert.equal(
    dashboard.recentRedesigns[0]?.replacementQuestTitle,
    redesigned.journey.currentQuest.title,
  )
})

test('다중 재설계 기록은 각 ID의 revision title을 유지하고 current quest를 history에서 제외한다', async () => {
  clearAuthMockSession()
  clearQuestMockSession()
  const auth = await authMockApi.signup({
    email: 'dashboard-multiple-redesigns@example.com',
    password: 'password123',
    name: '다중 재설계 사용자',
  })
  await onboardingMockApi.upsert(
    {
      desiredJob: '프론트엔드 개발자',
      desiredWorkType: 'FULL_TIME',
      careerGapMonths: 4,
      hasResume: true,
      interviewExperience: 'LIMITED',
    },
    auth.accessToken,
  )
  const plan = await questMockApi.generate(
    { energyLevel: 'MEDIUM' },
    auth.accessToken,
  )
  const original = plan.journeys[1].currentQuest
  const firstRedesign = await questOutcomeMockApi.redesign(
    original.id,
    { reasonCode: 'TIME_SHORTAGE' },
    auth.accessToken,
  )
  const firstReplacement = firstRedesign.journey.currentQuest
  const secondRedesign = await questOutcomeMockApi.redesign(
    firstReplacement.id,
    { reasonCode: 'TASK_TOO_LARGE' },
    auth.accessToken,
  )
  const secondReplacement = secondRedesign.journey.currentQuest

  assert.deepEqual(
    secondRedesign.journey.history.map(({ id }) => id),
    [original.id, firstReplacement.id],
  )
  assert.ok(
    !secondRedesign.journey.history.some(
      ({ id }) => id === secondReplacement.id,
    ),
  )

  const dashboard = await dashboardMockApi.getToday(auth.accessToken)
  assert.equal(dashboard.redesignCount, 2)
  assert.deepEqual(
    dashboard.recentRedesigns.map(
      ({ originalQuestTitle, replacementQuestTitle }) => [
        originalQuestTitle,
        replacementQuestTitle,
      ],
    ),
    [
      [firstReplacement.title, secondReplacement.title],
      [original.title, firstReplacement.title],
    ],
  )
  assert.notEqual(
    dashboard.recentRedesigns[1]?.replacementQuestTitle,
    secondReplacement.title,
  )
})
