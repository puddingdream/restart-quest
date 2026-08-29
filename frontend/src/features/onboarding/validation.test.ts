import assert from 'node:assert/strict'
import test from 'node:test'
import type { OnboardingFormValues } from './types'
import { toOnboardingRequest, validateOnboarding } from './validation'

const validValues: OnboardingFormValues = {
  desiredJob: '백엔드 개발자',
  region: '서울',
  desiredWorkType: 'FULL_TIME',
  careerGapMonths: '8',
  hasResume: true,
  interviewExperience: 'LIMITED',
}

test('canonical 온보딩 enum과 길이 범위를 통과한다', () => {
  assert.deepEqual(validateOnboarding(validValues), {})
  assert.deepEqual(toOnboardingRequest(validValues), {
    ...validValues,
    careerGapMonths: 8,
  })
})

test('희망 직무 2~80자와 선택 지역 80자를 검증한다', () => {
  const errors = validateOnboarding({
    ...validValues,
    desiredJob: 'a',
    region: '가'.repeat(81),
  })
  assert.match(errors.desiredJob ?? '', /2~80자/)
  assert.match(errors.region ?? '', /80자/)
})

test('빈 공백 기간은 필수 입력 오류로 처리하고 요청을 만들지 않는다', () => {
  const values = { ...validValues, careerGapMonths: '' }

  assert.match(validateOnboarding(values).careerGapMonths ?? '', /입력/)
  assert.equal(toOnboardingRequest(values), null)
})

test('문자열 0과 0~600 범위 값은 숫자로 요청에 포함한다', () => {
  const zeroValues = { ...validValues, careerGapMonths: '0' }
  const positiveValues = { ...validValues, careerGapMonths: '24' }
  const upperBoundaryValues = { ...validValues, careerGapMonths: '600' }

  assert.deepEqual(validateOnboarding(zeroValues), {})
  assert.equal(toOnboardingRequest(zeroValues)?.careerGapMonths, 0)
  assert.deepEqual(validateOnboarding(positiveValues), {})
  assert.equal(toOnboardingRequest(positiveValues)?.careerGapMonths, 24)
  assert.deepEqual(validateOnboarding(upperBoundaryValues), {})
  assert.equal(toOnboardingRequest(upperBoundaryValues)?.careerGapMonths, 600)
})

test('범위 밖이거나 정수가 아닌 공백 기간은 요청에 포함하지 않는다', () => {
  for (const careerGapMonths of ['-1', '601', '600.5']) {
    const values = { ...validValues, careerGapMonths }

    assert.match(validateOnboarding(values).careerGapMonths ?? '', /0~600개월/)
    assert.equal(toOnboardingRequest(values), null)
  }
})

test('공백 지역은 요청에서 생략한다', () => {
  const request = toOnboardingRequest({ ...validValues, region: '  ' })
  assert.ok(request)
  assert.equal('region' in request, false)
})

test('canonical enum 외 값은 검증 오류로 처리한다', () => {
  const values = {
    ...validValues,
    desiredWorkType: 'REMOTE',
    interviewExperience: 'SOME',
  } as unknown as OnboardingFormValues
  const errors = validateOnboarding(values)
  assert.ok(errors.desiredWorkType)
  assert.ok(errors.interviewExperience)
})
