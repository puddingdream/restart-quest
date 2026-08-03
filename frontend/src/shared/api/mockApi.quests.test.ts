import assert from 'node:assert/strict'
import test from 'node:test'
import type { AuthResponse } from '../../features/auth/types'
import type { OnboardingRequest } from '../../features/onboarding/types'
import type {
  DailyQuestResponse,
  QuestJourney,
  RedesignQuestResponse,
} from '../../features/quests/types'
import { ApiError } from './ApiError'
import {
  clearMockSession,
  mockRequest,
  queueMockQuestAiError,
} from './mockApi'

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
  },
})

const onboarding: OnboardingRequest = {
  desiredJob: '프론트엔드 개발자',
  region: '서울',
  desiredWorkType: 'FULL_TIME',
  careerGapMonths: 3,
  hasResume: true,
  interviewExperience: 'LIMITED',
}

async function createOnboardedSession(email: string): Promise<string> {
  clearMockSession()
  const auth = await mockRequest<AuthResponse>('/auth/signup', {
    method: 'POST',
    body: { email, name: '테스트 사용자' },
    accessToken: null,
  })
  await mockRequest('/onboarding/me', {
    method: 'PUT',
    body: onboarding,
    accessToken: auth.accessToken,
  })
  return auth.accessToken
}

function generatePlan(accessToken: string): Promise<DailyQuestResponse> {
  return mockRequest('/quests/today/generate', {
    method: 'POST',
    body: { energyLevel: 'MEDIUM' },
    accessToken,
  })
}

test('canonical mock은 empty에서 정확히 세 여정을 만들고 당일 재진입에 보존한다', async () => {
  const accessToken = await createOnboardedSession('journey@example.com')
  const empty = await mockRequest<DailyQuestResponse>('/quests/today', {
    method: 'GET',
    accessToken,
  })
  assert.equal(empty.journeys.length, 0)

  const generated = await mockRequest<DailyQuestResponse>(
    '/quests/today/generate',
    { method: 'POST', body: { energyLevel: 'MEDIUM' }, accessToken },
  )
  assert.equal(generated.generatedNow, true)
  assert.equal(generated.journeys.length, 3)
  assert.ok(
    generated.journeys.every(
      ({ currentQuest }) =>
        currentQuest.completionCriteria.length > 0 &&
        currentQuest.steps.length >= 1 &&
        currentQuest.steps.length <= 3,
    ),
  )

  const reentered = await mockRequest<DailyQuestResponse>('/quests/today', {
    method: 'GET',
    accessToken,
  })
  assert.equal(reentered.generatedNow, false)
  assert.deepEqual(
    reentered.journeys.map(({ journeyId }) => journeyId),
    generated.journeys.map(({ journeyId }) => journeyId),
  )

  const duplicate = await mockRequest<DailyQuestResponse>(
    '/quests/today/generate',
    { method: 'POST', body: { energyLevel: 'HIGH' }, accessToken },
  )
  assert.equal(duplicate.generatedNow, false)
  assert.equal(duplicate.energyLevel, 'MEDIUM')
  assert.equal(duplicate.journeys.length, 3)
})

test('canonical mock은 validation 오류를 field error로 구분한다', async () => {
  const accessToken = await createOnboardedSession('validation@example.com')

  await assert.rejects(
    mockRequest('/quests/today/generate', {
      method: 'POST',
      body: { energyLevel: 'UNKNOWN' },
      accessToken,
    }),
    (error: unknown) =>
      error instanceof ApiError &&
      error.code === 'VALIDATION_ERROR' &&
      error.fieldErrors[0]?.field === 'energyLevel',
  )
})

test('canonical mock의 AI 오류는 한 번 실패한 뒤 같은 입력으로 재시도할 수 있다', async () => {
  const accessToken = await createOnboardedSession('retry@example.com')
  queueMockQuestAiError('AI_PROVIDER_TIMEOUT')

  await assert.rejects(
    mockRequest('/quests/today/generate', {
      method: 'POST',
      body: { energyLevel: 'LOW' },
      accessToken,
    }),
    (error: unknown) =>
      error instanceof ApiError && error.code === 'AI_PROVIDER_TIMEOUT',
  )

  const retried = await mockRequest<DailyQuestResponse>(
    '/quests/today/generate',
    { method: 'POST', body: { energyLevel: 'LOW' }, accessToken },
  )
  assert.equal(retried.journeys.length, 3)
  assert.equal(retried.energyLevel, 'LOW')
})

test('이력서가 없는 사용자는 기존 이력서 수정을 전제하지 않는 퀘스트를 받는다', async () => {
  const accessToken = await createOnboardedSession('no-resume@example.com')
  await mockRequest('/onboarding/me', {
    method: 'PUT',
    body: { ...onboarding, hasResume: false },
    accessToken,
  })

  const generated = await generatePlan(accessToken)
  const resumeQuest = generated.journeys[0].currentQuest

  assert.equal(resumeQuest.title, '이력서에 넣을 경험 하나 고르기')
  assert.doesNotMatch(
    `${resumeQuest.description} ${resumeQuest.completionCriteria} ${resumeQuest.steps.join(' ')}`,
    /기존 이력서|이력서.+수정|반영해 저장/,
  )
})

test('이력서가 있는 사용자는 기존 문장을 다듬는 퀘스트를 유지한다', async () => {
  const accessToken = await createOnboardedSession('resume@example.com')
  const generated = await generatePlan(accessToken)

  assert.equal(
    generated.journeys[0].currentQuest.title,
    '이력서 한 문장 선명하게 다듬기',
  )
})

test('완료 요청은 같은 여정을 갱신하고 중복 처리를 거절한다', async () => {
  const accessToken = await createOnboardedSession('complete@example.com')
  const generated = await generatePlan(accessToken)
  const questId = generated.journeys[0].currentQuest.id

  const completed = await mockRequest<QuestJourney>(
    `/quests/${questId}/completion`,
    { method: 'POST', accessToken },
  )

  assert.equal(completed.status, 'COMPLETED')
  assert.equal(completed.currentQuest.status, 'DONE')
  await assert.rejects(
    mockRequest(`/quests/${questId}/completion`, {
      method: 'POST',
      accessToken,
    }),
    (error: unknown) =>
      error instanceof ApiError && error.code === 'QUEST_ALREADY_RESOLVED',
  )

  const refreshed = await mockRequest<DailyQuestResponse>('/quests/today', {
    method: 'GET',
    accessToken,
  })
  assert.equal(refreshed.journeys[0].status, 'COMPLETED')
})

test('재설계 요청은 이유를 기록하고 같은 카드의 현재 퀘스트를 교체한다', async () => {
  const accessToken = await createOnboardedSession('redesign@example.com')
  const generated = await generatePlan(accessToken)
  const original = generated.journeys[1].currentQuest

  const response = await mockRequest<RedesignQuestResponse>(
    `/quests/${original.id}/failure-redesign`,
    {
      method: 'POST',
      body: {
        reasonCode: 'TASK_TOO_LARGE',
        reasonNote: '  오늘은 첫 단계부터 시작하고 싶어요.  ',
      },
      accessToken,
    },
  )

  assert.notEqual(response.journey.currentQuest.id, original.id)
  assert.equal(response.journey.currentQuest.revision, original.revision + 1)
  assert.equal(response.journey.currentQuest.category, original.category)
  assert.ok(response.journey.currentQuest.estimatedMinutes <= 15)
  assert.equal(response.journey.history[0].status, 'REDESIGNED')
  assert.equal(response.journey.history.length, 2)
  assert.equal(response.redesign.reasonCode, 'TASK_TOO_LARGE')
  assert.equal(
    response.redesign.reasonNote,
    '오늘은 첫 단계부터 시작하고 싶어요.',
  )

  const refreshed = await mockRequest<DailyQuestResponse>('/quests/today', {
    method: 'GET',
    accessToken,
  })
  assert.equal(
    refreshed.journeys[1].currentQuest.id,
    response.journey.currentQuest.id,
  )
})

test('재설계는 잘못된 이유와 긴 메모를 거절하고 현재 퀘스트를 보존한다', async () => {
  const accessToken = await createOnboardedSession(
    'redesign-validation@example.com',
  )
  const generated = await generatePlan(accessToken)
  const original = generated.journeys[2].currentQuest

  await assert.rejects(
    mockRequest(`/quests/${original.id}/failure-redesign`, {
      method: 'POST',
      body: { reasonCode: 'UNKNOWN', reasonNote: '가'.repeat(301) },
      accessToken,
    }),
    (error: unknown) =>
      error instanceof ApiError &&
      error.code === 'VALIDATION_ERROR' &&
      error.fieldErrors.some(({ field }) => field === 'reasonCode') &&
      error.fieldErrors.some(({ field }) => field === 'reasonNote'),
  )

  const refreshed = await mockRequest<DailyQuestResponse>('/quests/today', {
    method: 'GET',
    accessToken,
  })
  assert.equal(refreshed.journeys[2].currentQuest.id, original.id)
})

test('재설계 AI 오류는 계획을 바꾸지 않고 같은 입력으로 재시도할 수 있다', async () => {
  const accessToken = await createOnboardedSession('redesign-retry@example.com')
  const generated = await generatePlan(accessToken)
  const original = generated.journeys[2].currentQuest
  const request = {
    method: 'POST' as const,
    body: { reasonCode: 'LOW_ENERGY', reasonNote: '첫 단계면 시작할 수 있어요.' },
    accessToken,
  }
  queueMockQuestAiError('AI_PROVIDER_TIMEOUT')

  await assert.rejects(
    mockRequest(`/quests/${original.id}/failure-redesign`, request),
    (error: unknown) =>
      error instanceof ApiError && error.code === 'AI_PROVIDER_TIMEOUT',
  )
  const unchanged = await mockRequest<DailyQuestResponse>('/quests/today', {
    method: 'GET',
    accessToken,
  })
  assert.equal(unchanged.journeys[2].currentQuest.id, original.id)

  const retried = await mockRequest<RedesignQuestResponse>(
    `/quests/${original.id}/failure-redesign`,
    request,
  )
  assert.equal(retried.redesign.reasonCode, 'LOW_ENERGY')
  assert.equal(retried.redesign.reasonNote, request.body.reasonNote)
})
