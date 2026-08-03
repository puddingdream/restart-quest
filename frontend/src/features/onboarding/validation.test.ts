import assert from 'node:assert/strict'
import test from 'node:test'
import type { OnboardingFormValues } from './types'
import { toOnboardingRequest, validateOnboarding } from './validation'

const validValues: OnboardingFormValues = {
  desiredJob: '백엔드 개발자',
  region: '서울',
  desiredWorkType: 'FULL_TIME',
  careerGapMonths: 8,
  hasResume: true,
  interviewExperience: 'LIMITED',
}

test('canonical 온보딩 enum과 길이 범위를 통과한다', () => {
  assert.deepEqual(validateOnboarding(validValues), {})
  assert.deepEqual(toOnboardingRequest(validValues), validValues)
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

test('공백 기간은 0~600개월 정수만 허용한다', () => {
  assert.ok(
    validateOnboarding({ ...validValues, careerGapMonths: 600.5 })
      .careerGapMonths,
  )
  assert.ok(
    validateOnboarding({ ...validValues, careerGapMonths: 601 })
      .careerGapMonths,
  )
})

test('공백 지역은 요청에서 생략한다', () => {
  const request = toOnboardingRequest({ ...validValues, region: '  ' })
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
