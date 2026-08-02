import assert from 'node:assert/strict'
import test from 'node:test'
import type { AuthResponse } from '../../features/auth/types'
import type { OnboardingRequest } from '../../features/onboarding/types'
import type { DailyQuestResponse } from '../../features/quests/types'
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
