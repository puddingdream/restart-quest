import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { OnboardingFormValues } from '../types'
import { OnboardingForm } from './OnboardingForm'

const values: OnboardingFormValues = {
  desiredJob: '백엔드 개발자',
  region: '서울',
  desiredWorkType: 'FULL_TIME',
  careerGapMonths: 8,
  hasResume: true,
  interviewExperience: 'LIMITED',
}

const updateField = () => undefined
const submit = async () => undefined

test('온보딩 폼은 canonical enum 선택지와 입력 범위를 렌더링한다', () => {
  const markup = renderToStaticMarkup(
    <OnboardingForm
      values={values}
      errors={{}}
      isSubmitting={false}
      apiError={null}
      updateField={updateField}
      onSubmit={submit}
    />,
  )

  assert.match(markup, /FULL_TIME/)
  assert.match(markup, /CONTRACT/)
  assert.match(markup, /PART_TIME/)
  assert.match(markup, /EXPERIENCED/)
  assert.match(markup, /max="600"/)
  assert.match(markup, /maxlength="80"/i)
})

test('validation, API error와 제출 loading 상태를 노출한다', () => {
  const markup = renderToStaticMarkup(
    <OnboardingForm
      values={{ ...values, desiredJob: '' }}
      errors={{
        desiredJob: '희망 직무는 2~80자로 입력해 주세요.',
        desiredWorkType: '희망 근무 형태를 선택해 주세요.',
        interviewExperience: '면접 경험을 선택해 주세요.',
      }}
      isSubmitting
      apiError="저장하지 못했습니다."
      updateField={updateField}
      onSubmit={submit}
    />,
  )

  assert.match(markup, /aria-invalid="true"/)
  assert.match(markup, /role="alert"/)
  assert.match(markup, /aria-describedby="desiredWorkType-error"/)
  assert.match(markup, /aria-describedby="interviewExperience-error"/)
  assert.match(markup, /희망 근무 형태를 선택해 주세요/)
  assert.match(markup, /면접 경험을 선택해 주세요/)
  assert.match(markup, /시작점을 저장하고 있어요/)
  assert.match(markup, /disabled=""/)
})
