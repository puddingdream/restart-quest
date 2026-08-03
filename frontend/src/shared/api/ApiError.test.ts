import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError, isApiErrorStatus, isSessionExpired } from './ApiError'

test('401과 403만 만료된 세션으로 분류한다', () => {
  assert.equal(isSessionExpired(new ApiError(401, 'UNAUTHORIZED', '')), true)
  assert.equal(isSessionExpired(new ApiError(403, 'FORBIDDEN', '')), true)
  assert.equal(isSessionExpired(new ApiError(500, 'SERVER_ERROR', '')), false)
  assert.equal(isSessionExpired(new TypeError('network unavailable')), false)
})

test('요청 상태 비교는 ApiError의 정확한 status만 허용한다', () => {
  assert.equal(
    isApiErrorStatus(new ApiError(404, 'ONBOARDING_NOT_FOUND', ''), 404),
    true,
  )
  assert.equal(isApiErrorStatus(new ApiError(500, 'SERVER_ERROR', ''), 404), false)
  assert.equal(isApiErrorStatus(new Error('network unavailable'), 404), false)
})
