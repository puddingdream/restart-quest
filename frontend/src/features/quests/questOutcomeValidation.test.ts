import assert from 'node:assert/strict'
import test from 'node:test'
import {
  toRedesignQuestRequest,
  validateRedesignForm,
} from './questOutcomeValidation'

export function registerQuestOutcomeValidationTests(): void {
  test('canonical reasonCode를 반드시 선택해야 한다', () => {
    const errors = validateRedesignForm({ reasonCode: '', reasonNote: '' })

    assert.match(errors.reasonCode ?? '', /이유를 하나 선택/)
  })

  test('선택 메모는 최대 300자까지 허용하고 공백을 정리한다', () => {
    const validRequest = toRedesignQuestRequest({
      reasonCode: 'TIME_SHORTAGE',
      reasonNote: `  ${'가'.repeat(296)}  `,
    })
    const invalidRequest = toRedesignQuestRequest({
      reasonCode: 'TIME_SHORTAGE',
      reasonNote: '가'.repeat(301),
    })

    assert.equal(validRequest?.reasonNote?.length, 296)
    assert.equal(invalidRequest, null)
  })
}
