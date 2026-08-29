export const DESIRED_WORK_TYPES = [
  'FULL_TIME',
  'CONTRACT',
  'PART_TIME',
  'ANY',
] as const

export type DesiredWorkType = (typeof DESIRED_WORK_TYPES)[number]

export const INTERVIEW_EXPERIENCES = [
  'NONE',
  'LIMITED',
  'EXPERIENCED',
] as const

export type InterviewExperience = (typeof INTERVIEW_EXPERIENCES)[number]

export interface OnboardingFormValues {
  desiredJob: string
  region: string
  desiredWorkType: DesiredWorkType
  careerGapMonths: string
  hasResume: boolean
  interviewExperience: InterviewExperience
}

export interface OnboardingRequest {
  desiredJob: string
  region?: string
  desiredWorkType: DesiredWorkType
  careerGapMonths: number
  hasResume: boolean
  interviewExperience: InterviewExperience
}

export interface OnboardingProfile extends OnboardingRequest {
  userId: string
  updatedAt: string
}

export interface OnboardingResponse {
  profile: OnboardingProfile
  onboardingCompleted: true
}

export const WORK_TYPE_LABELS: Record<DesiredWorkType, string> = {
  FULL_TIME: '정규직',
  CONTRACT: '계약직',
  PART_TIME: '시간제',
  ANY: '열어두고 있어요',
}

export const INTERVIEW_LABELS: Record<InterviewExperience, string> = {
  NONE: '아직 없어요',
  LIMITED: '1~2번 있어요',
  EXPERIENCED: '여러 번 있어요',
}
