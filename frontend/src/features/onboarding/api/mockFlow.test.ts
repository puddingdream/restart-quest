import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError } from '../../../shared/api/ApiError'
import { authMockApi, clearAuthMockSession } from '../../auth/api/authMockApi'
import { onboardingMockApi } from './onboardingMockApi'

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

const sessionStorage = new MemoryStorage()
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    sessionStorage,
    setTimeout(callback: () => void) {
      callback()
      return 0
    },
  },
})

test.beforeEach(() => sessionStorage.clear())

test('인증과 온보딩 mock handler가 feature 경계에서 같은 사용자 상태를 연결한다', async () => {
  const signup = await authMockApi.signup({
    name: ' 다시 시작 ',
    email: 'USER@EXAMPLE.COM',
    password: 'safe-password',
  })

  assert.equal(signup.user.email, 'user@example.com')
  await assert.rejects(
    onboardingMockApi.getMe(signup.accessToken),
    (error: unknown) => error instanceof ApiError && error.status === 404,
  )

  const onboarding = await onboardingMockApi.upsert(
    {
      desiredJob: '프론트엔드 개발자',
      desiredWorkType: 'FULL_TIME',
      careerGapMonths: 3,
      hasResume: true,
      interviewExperience: 'LIMITED',
    },
    signup.accessToken,
  )

  assert.equal(onboarding.profile.userId, signup.user.id)
  assert.equal(
    (await authMockApi.me(signup.accessToken)).onboardingCompleted,
    true,
  )
  assert.deepEqual(await onboardingMockApi.getMe(signup.accessToken), onboarding)
})

test('인증 mock session을 지우면 이전 token으로 사용자 상태를 읽지 못한다', async () => {
  const signup = await authMockApi.signup({
    name: '사용자',
    email: 'user@example.com',
    password: 'safe-password',
  })

  clearAuthMockSession()

  await assert.rejects(
    authMockApi.me(signup.accessToken),
    (error: unknown) => error instanceof ApiError && error.status === 401,
  )
})
