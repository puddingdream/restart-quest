import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError } from '../../shared/api/ApiError'
import { getQuestOutcomeErrorFeedback } from './questOutcomeErrorFeedback'
import {
  toRedesignQuestRequest,
  validateRedesignForm,
} from './questOutcomeValidation'

test('canonical reasonCode를 선택하고 선택 메모를 300자 이내로 제한한다', () => {
  const missingReason = validateRedesignForm({
    reasonCode: '',
    reasonNote: '',
  })
  const validRequest = toRedesignQuestRequest({
    reasonCode: 'TIME_SHORTAGE',
    reasonNote: `  ${'가'.repeat(296)}  `,
  })
  const invalidRequest = toRedesignQuestRequest({
    reasonCode: 'TIME_SHORTAGE',
    reasonNote: '가'.repeat(301),
  })

  assert.match(missingReason.reasonCode ?? '', /이유를 하나 선택/)
  assert.equal(validRequest?.reasonNote?.length, 296)
  assert.equal(invalidRequest, null)
})

test('이미 바뀐 퀘스트는 중복 제출 대신 최신 목록 확인을 안내한다', () => {
  const feedback = getQuestOutcomeErrorFeedback(
    new ApiError(409, 'QUEST_ALREADY_RESOLVED', '이미 처리됨'),
    'completion',
  )

  assert.equal(feedback.action, 'refresh')
  assert.match(feedback.message, /최신 상태/)
})

test('재설계 provider 오류는 원문을 숨기고 입력 유지와 재시도를 안내한다', () => {
  const feedback = getQuestOutcomeErrorFeedback(
    new ApiError(504, 'AI_PROVIDER_TIMEOUT', 'provider raw detail'),
    'redesign',
  )

  assert.equal(feedback.action, 'retry')
  assert.match(feedback.message, /유지/)
  assert.doesNotMatch(feedback.message, /provider raw detail/)
})
