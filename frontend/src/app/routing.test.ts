import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveRoute } from './routing'

test('비로그인 사용자는 루트와 보호 경로에서 로그인으로 이동한다', () => {
  assert.deepEqual(resolveRoute('/', null), {
    kind: 'redirect',
    to: '/login',
  })
  assert.deepEqual(resolveRoute('/today', null), {
    kind: 'redirect',
    to: '/login',
  })
  assert.deepEqual(resolveRoute('/dashboard', null), {
    kind: 'redirect',
    to: '/login',
  })
  assert.deepEqual(resolveRoute('/onboarding', null), {
    kind: 'redirect',
    to: '/login',
  })
  assert.deepEqual(resolveRoute('/login', null), {
    kind: 'view',
    route: '/login',
  })
  assert.deepEqual(resolveRoute('/signup', null), {
    kind: 'view',
    route: '/signup',
  })
})

test('온보딩 미완료 사용자는 핵심 경로에서 온보딩으로 이동한다', () => {
  const user = { onboardingCompleted: false }
  assert.deepEqual(resolveRoute('/login', user), {
    kind: 'redirect',
    to: '/onboarding',
  })
  assert.deepEqual(resolveRoute('/signup', user), {
    kind: 'redirect',
    to: '/onboarding',
  })
  assert.deepEqual(resolveRoute('/today', user), {
    kind: 'redirect',
    to: '/onboarding',
  })
  assert.deepEqual(resolveRoute('/dashboard', user), {
    kind: 'redirect',
    to: '/onboarding',
  })
  assert.deepEqual(resolveRoute('/onboarding', user), {
    kind: 'view',
    route: '/onboarding',
  })
})

test('온보딩 완료 사용자는 today와 dashboard에 진입한다', () => {
  const user = { onboardingCompleted: true }
  assert.deepEqual(resolveRoute('/', user), {
    kind: 'redirect',
    to: '/today',
  })
  assert.deepEqual(resolveRoute('/today', user), {
    kind: 'view',
    route: '/today',
  })
  assert.deepEqual(resolveRoute('/dashboard', user), {
    kind: 'view',
    route: '/dashboard',
  })
  assert.deepEqual(resolveRoute('/login', user), {
    kind: 'redirect',
    to: '/today',
  })
  assert.deepEqual(resolveRoute('/signup', user), {
    kind: 'redirect',
    to: '/today',
  })
  assert.deepEqual(resolveRoute('/onboarding', user), {
    kind: 'view',
    route: '/onboarding',
  })
})

test('알 수 없는 경로는 인증 상태에 맞는 핵심 진입점으로 보낸다', () => {
  assert.deepEqual(resolveRoute('/unknown', null), {
    kind: 'redirect',
    to: '/login',
  })
  assert.deepEqual(resolveRoute('/unknown', { onboardingCompleted: true }), {
    kind: 'redirect',
    to: '/today',
  })
})
