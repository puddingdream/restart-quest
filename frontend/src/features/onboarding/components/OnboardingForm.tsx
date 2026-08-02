import type { FormEvent } from 'react'
import {
  DESIRED_WORK_TYPES,
  INTERVIEW_EXPERIENCES,
  INTERVIEW_LABELS,
  WORK_TYPE_LABELS,
  type OnboardingFormValues,
} from '../types'
import type { OnboardingErrors } from '../validation'

interface OnboardingFormProps {
  values: OnboardingFormValues
  errors: OnboardingErrors
  isSubmitting: boolean
  apiError: string | null
  updateField: <K extends keyof OnboardingFormValues>(
    field: K,
    value: OnboardingFormValues[K],
  ) => void
  onSubmit: () => Promise<void>
}

export function OnboardingForm({
  values,
  errors,
  isSubmitting,
  apiError,
  updateField,
  onSubmit,
}: OnboardingFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onSubmit()
  }

  return (
    <form className="onboarding-form" onSubmit={handleSubmit} noValidate>
      {apiError && (
        <div className="alert alert-error" role="alert">
          <span aria-hidden="true">!</span>
          <p>{apiError}</p>
        </div>
      )}

      <div className="field-grid">
        <div className="field-group field-span-2">
          <div className="label-row">
            <label htmlFor="desiredJob">희망 직무</label>
            <span>{values.desiredJob.length}/80</span>
          </div>
          <input
            id="desiredJob"
            value={values.desiredJob}
            onChange={(event) => updateField('desiredJob', event.target.value)}
            placeholder="예: 백엔드 개발자"
            minLength={2}
            maxLength={80}
            aria-invalid={Boolean(errors.desiredJob)}
            aria-describedby={
              errors.desiredJob
                ? 'desiredJob-help desiredJob-error'
                : 'desiredJob-help'
            }
            disabled={isSubmitting}
          />
          <p className="field-help" id="desiredJob-help">
            지금 가장 먼저 준비하고 싶은 직무를 적어주세요.
          </p>
          {errors.desiredJob && (
            <p className="field-error" id="desiredJob-error">
              {errors.desiredJob}
            </p>
          )}
        </div>

        <div className="field-group">
          <div className="label-row">
            <label htmlFor="region">희망 지역</label>
            <span>선택 · {values.region.length}/80</span>
          </div>
          <input
            id="region"
            value={values.region}
            onChange={(event) => updateField('region', event.target.value)}
            placeholder="예: 서울 또는 원격"
            maxLength={80}
            aria-invalid={Boolean(errors.region)}
            aria-describedby={errors.region ? 'region-error' : undefined}
            disabled={isSubmitting}
          />
          {errors.region && (
            <p className="field-error" id="region-error">
              {errors.region}
            </p>
          )}
        </div>

        <div className="field-group">
          <label htmlFor="careerGapMonths">취업 공백 기간</label>
          <div className="input-suffix">
            <input
              id="careerGapMonths"
              type="number"
              inputMode="numeric"
              min={0}
              max={600}
              step={1}
              value={values.careerGapMonths}
              onChange={(event) =>
                updateField('careerGapMonths', Number(event.target.value))
              }
              aria-invalid={Boolean(errors.careerGapMonths)}
              aria-describedby={
                errors.careerGapMonths ? 'careerGapMonths-error' : undefined
              }
              disabled={isSubmitting}
            />
            <span>개월</span>
          </div>
          {errors.careerGapMonths && (
            <p className="field-error" id="careerGapMonths-error">
              {errors.careerGapMonths}
            </p>
          )}
        </div>

        <div className="field-group">
          <label htmlFor="desiredWorkType">희망 근무 형태</label>
          <select
            id="desiredWorkType"
            value={values.desiredWorkType}
            onChange={(event) =>
              updateField(
                'desiredWorkType',
                event.target.value as OnboardingFormValues['desiredWorkType'],
              )
            }
            aria-invalid={Boolean(errors.desiredWorkType)}
            aria-describedby={
              errors.desiredWorkType ? 'desiredWorkType-error' : undefined
            }
            disabled={isSubmitting}
          >
            {DESIRED_WORK_TYPES.map((workType) => (
              <option value={workType} key={workType}>
                {WORK_TYPE_LABELS[workType]}
              </option>
            ))}
          </select>
          {errors.desiredWorkType && (
            <p className="field-error" id="desiredWorkType-error">
              {errors.desiredWorkType}
            </p>
          )}
        </div>

        <fieldset className="field-group choice-fieldset">
          <legend>현재 이력서가 있나요?</legend>
          <div className="segmented-control">
            <label>
              <input
                type="radio"
                name="hasResume"
                checked={values.hasResume}
                onChange={() => updateField('hasResume', true)}
                disabled={isSubmitting}
              />
              <span>네, 있어요</span>
            </label>
            <label>
              <input
                type="radio"
                name="hasResume"
                checked={!values.hasResume}
                onChange={() => updateField('hasResume', false)}
                disabled={isSubmitting}
              />
              <span>아직 없어요</span>
            </label>
          </div>
        </fieldset>

        <div className="field-group field-span-2">
          <label htmlFor="interviewExperience">면접 경험</label>
          <select
            id="interviewExperience"
            value={values.interviewExperience}
            onChange={(event) =>
              updateField(
                'interviewExperience',
                event.target
                  .value as OnboardingFormValues['interviewExperience'],
              )
            }
            aria-invalid={Boolean(errors.interviewExperience)}
            aria-describedby={
              errors.interviewExperience
                ? 'interviewExperience-error'
                : undefined
            }
            disabled={isSubmitting}
          >
            {INTERVIEW_EXPERIENCES.map((experience) => (
              <option value={experience} key={experience}>
                {INTERVIEW_LABELS[experience]}
              </option>
            ))}
          </select>
          {errors.interviewExperience && (
            <p className="field-error" id="interviewExperience-error">
              {errors.interviewExperience}
            </p>
          )}
        </div>
      </div>

      <div className="onboarding-actions">
        <p>
          입력한 정보는 사용자를 평가하지 않고, 오늘의 행동 크기를 조절하는 데만
          사용해요.
        </p>
        <button className="button button-primary" disabled={isSubmitting}>
          {isSubmitting && <span className="spinner" aria-hidden="true" />}
          {isSubmitting ? '시작점을 저장하고 있어요' : '오늘의 퀘스트로 이동'}
        </button>
      </div>
    </form>
  )
}
