import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError } from '../../shared/api/ApiError'
import { getQuestErrorFeedback } from './questErrorFeedback'
import { registerQuestOutcomeErrorFeedbackTests } from './questOutcomeErrorFeedback.test'
import { registerQuestOutcomeValidationTests } from './questOutcomeValidation.test'

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
    assert.match(feedback.title, new RegExp(expectedTitle))
    assert.doesNotMatch(feedback.message, /provider detail/)
  })
}

registerQuestOutcomeErrorFeedbackTests()
registerQuestOutcomeValidationTests()
