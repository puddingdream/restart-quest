import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError } from '../../shared/api/ApiError'
import { getQuestOutcomeErrorFeedback } from './questOutcomeErrorFeedback'

const redesignErrors = [
  'AI_QUOTA_EXCEEDED',
  'AI_INVALID_RESPONSE',
  'AI_PROVIDER_UNAVAILABLE',
  'AI_PROVIDER_TIMEOUT',
] as const

export function registerQuestOutcomeErrorFeedbackTests(): void {
  for (const code of redesignErrors) {
    test(`${code} 재설계 오류는 입력 유지와 재시도를 안내한다`, () => {
      const feedback = getQuestOutcomeErrorFeedback(
        new ApiError(503, code, 'provider raw detail'),
        'redesign',
      )

      assert.equal(feedback.code, code)
      assert.equal(feedback.action, 'retry')
      assert.match(feedback.message, /유지|그대로/)
      assert.doesNotMatch(feedback.message, /provider raw detail/)
    })
  }

  test('이미 바뀐 퀘스트는 중복 제출 대신 최신 목록 확인을 안내한다', () => {
    const feedback = getQuestOutcomeErrorFeedback(
      new ApiError(409, 'QUEST_ALREADY_RESOLVED', '이미 처리됨'),
      'completion',
    )

    assert.equal(feedback.action, 'refresh')
    assert.match(feedback.message, /최신 상태/)
  })
}
