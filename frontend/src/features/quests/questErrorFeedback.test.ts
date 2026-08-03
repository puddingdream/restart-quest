import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError } from '../../shared/api/ApiError'
import { getQuestErrorFeedback } from './questErrorFeedback'

const aiErrors = [
  ['AI_QUOTA_EXCEEDED', '붐비고 있어요'],
  ['AI_INVALID_RESPONSE', '구성을 다시 확인'],
  ['AI_PROVIDER_UNAVAILABLE', '연결할 수 없어요'],
  ['AI_PROVIDER_TIMEOUT', '평소보다 오래'],
] as const

for (const [code, expectedTitle] of aiErrors) {
  test(`${code}는 구분 가능한 재시도 안내를 제공한다`, () => {
    const feedback = getQuestErrorFeedback(
      new ApiError(503, code, 'provider detail'),
      'generate',
    )

    assert.equal(feedback.code, code)
    assert.equal(feedback.source, 'generate')
    assert.equal(feedback.action, 'retry')
    assert.match(feedback.title, new RegExp(expectedTitle))
    assert.doesNotMatch(feedback.message, /provider detail/)
  })
}

test('SESSION_EXPIRED는 다시 로그인해야 하는 오류로 명시적으로 분류한다', () => {
  const feedback = getQuestErrorFeedback(
    new ApiError(401, 'SESSION_EXPIRED', 'raw auth detail'),
    'load',
  )

  assert.equal(feedback.action, 'login')
  assert.match(feedback.title, /로그인 시간이 만료/)
  assert.match(feedback.message, /다시 로그인/)
  assert.doesNotMatch(feedback.message, /raw auth detail|잠시 후 다시 시도/)
})

test('401 응답은 오류 code가 유실되어도 반복 재시도로 보내지 않는다', () => {
  const feedback = getQuestErrorFeedback(
    new ApiError(401, 'REQUEST_FAILED', 'malformed response'),
    'generate',
  )

  assert.equal(feedback.code, 'SESSION_EXPIRED')
  assert.equal(feedback.action, 'login')
})
