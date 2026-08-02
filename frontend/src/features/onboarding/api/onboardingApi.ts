import { apiRequest } from '../../../shared/api/apiRequest'
import type { OnboardingRequest, OnboardingResponse } from '../types'

export const onboardingApi = {
  getMe() {
    return apiRequest<OnboardingResponse>('/onboarding/me')
  },
  upsert(input: OnboardingRequest) {
    return apiRequest<OnboardingResponse>('/onboarding/me', {
      method: 'PUT',
      body: input,
    })
  },
}
