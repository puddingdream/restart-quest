import assert from 'node:assert/strict'
import test from 'node:test'
import { fillOnboardingHappyPath } from './onboardingFlow.mjs'

test('browser happy path는 필수 공백 기간에 유효한 값 8을 입력한다', async () => {
  const fields = []
  const page = {}

  await fillOnboardingHappyPath(page, async (observedPage, selector, value) => {
    assert.equal(observedPage, page)
    fields.push([selector, value])
  })

  assert.deepEqual(fields, [
    ['#desiredJob', '프론트엔드 개발자'],
    ['#region', '서울 또는 원격'],
    ['#careerGapMonths', '8'],
  ])
})
