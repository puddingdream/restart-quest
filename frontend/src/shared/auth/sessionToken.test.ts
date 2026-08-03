import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearAccessToken,
  getAccessToken,
  storeAccessToken,
} from './sessionToken'
import { mockRequest } from '../api/mockApi'
import type { AuthResponse } from '../../features/auth/types'
import type { OnboardingResponse } from '../../features/onboarding/types'

function createMemoryStorage(): Storage {
  const values = new Map<string, string>()

  return {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key) {
      return values.get(key) ?? null
    },
    key(index) {
      return [...values.keys()][index] ?? null
    },
    removeItem(key) {
      values.delete(key)
    },
    setItem(key, value) {
      values.set(key, value)
    },
  }
}

test('access token은 sessionStorage에만 저장하고 삭제한다', () => {
  const sessionStorage = createMemoryStorage()
  const localStorage = createMemoryStorage()
  const location = { href: 'https://restart.quest/login' }
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { sessionStorage, localStorage, location },
  })

  try {
    storeAccessToken('test-only-token')
    assert.equal(getAccessToken(), 'test-only-token')
    assert.equal(localStorage.length, 0)
    assert.equal(location.href, 'https://restart.quest/login')

    clearAccessToken()
    assert.equal(getAccessToken(), null)
  } finally {
    Reflect.deleteProperty(globalThis, 'window')
  }
})

test('로그아웃 후 같은 mock 사용자가 다시 로그인하면 온보딩 정보를 유지한다', async () => {
  const sessionStorage = createMemoryStorage()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      sessionStorage,
      setTimeout(callback: () => void) {
        callback()
        return 1
      },
    },
  })

  try {
    const signup = await mockRequest<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: { email: 'user@example.com', name: '사용자' },
      accessToken: null,
    })
    storeAccessToken(signup.accessToken)
    await mockRequest<OnboardingResponse>('/onboarding/me', {
      method: 'PUT',
      body: {
        desiredJob: '프론트엔드 개발자',
        region: '서울',
        desiredWorkType: 'FULL_TIME',
        careerGapMonths: 3,
        hasResume: true,
        interviewExperience: 'LIMITED',
      },
      accessToken: signup.accessToken,
    })

    clearAccessToken()
    const login = await mockRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { email: 'user@example.com' },
      accessToken: null,
    })
    const restored = await mockRequest<OnboardingResponse>('/onboarding/me', {
      method: 'GET',
      accessToken: login.accessToken,
    })

    assert.equal(login.user.onboardingCompleted, true)
    assert.equal(restored.profile.desiredJob, '프론트엔드 개발자')

    const anotherSignup = await mockRequest<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: { email: 'another@example.com', name: '다른 사용자' },
      accessToken: null,
    })
    await assert.rejects(
      mockRequest('/onboarding/me', {
        method: 'GET',
        accessToken: anotherSignup.accessToken,
      }),
      { status: 404, code: 'ONBOARDING_NOT_FOUND' },
    )
  } finally {
    Reflect.deleteProperty(globalThis, 'window')
  }
})
