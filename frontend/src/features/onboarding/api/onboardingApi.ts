import { apiRequest } from '../../../shared/api/apiRequest'
import type { OnboardingRequest, OnboardingResponse } from '../types'
import { onboardingMockApi } from './onboardingMockApi'

export const onboardingApi = {
  getMe() {
    return apiRequest<OnboardingResponse>('/onboarding/me', {
      mock: ({ accessToken }) => onboardingMockApi.getMe(accessToken),
    })
  },
  upsert(input: OnboardingRequest) {
    return apiRequest<OnboardingResponse>('/onboarding/me', {
      method: 'PUT',
      body: input,
      mock: ({ accessToken }) =>
        onboardingMockApi.upsert(input, accessToken),
    })
  },
}
