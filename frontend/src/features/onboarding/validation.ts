import {
  DESIRED_WORK_TYPES,
  INTERVIEW_EXPERIENCES,
  type OnboardingFormValues,
  type OnboardingRequest,
} from './types'

export type OnboardingErrors = Partial<
  Record<keyof OnboardingFormValues, string>
>

export function validateOnboarding(
  values: OnboardingFormValues,
): OnboardingErrors {
  const errors: OnboardingErrors = {}
  const desiredJobLength = values.desiredJob.trim().length
  if (desiredJobLength < 2 || desiredJobLength > 80) {
    errors.desiredJob = '희망 직무는 2~80자로 입력해 주세요.'
  }
  if (values.region.trim().length > 80) {
    errors.region = '지역은 80자 이내로 입력해 주세요.'
  }
  if (!DESIRED_WORK_TYPES.includes(values.desiredWorkType)) {
    errors.desiredWorkType = '희망 근무 형태를 선택해 주세요.'
  }
  if (
    !Number.isInteger(values.careerGapMonths) ||
    values.careerGapMonths < 0 ||
    values.careerGapMonths > 600
  ) {
    errors.careerGapMonths = '공백 기간은 0~600개월의 정수로 입력해 주세요.'
  }
  if (!INTERVIEW_EXPERIENCES.includes(values.interviewExperience)) {
    errors.interviewExperience = '면접 경험을 선택해 주세요.'
  }
  return errors
}

export function toOnboardingRequest(
  values: OnboardingFormValues,
): OnboardingRequest {
  const region = values.region.trim()
  return {
    desiredJob: values.desiredJob.trim(),
    ...(region ? { region } : {}),
    desiredWorkType: values.desiredWorkType,
    careerGapMonths: values.careerGapMonths,
    hasResume: values.hasResume,
    interviewExperience: values.interviewExperience,
  }
}
