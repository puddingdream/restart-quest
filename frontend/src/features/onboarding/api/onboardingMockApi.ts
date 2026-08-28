import { ApiError } from '../../../shared/api/ApiError'
import {
  markMockUserOnboarded,
  requireMockUser,
} from '../../auth/api/authMockApi'
import type {
  OnboardingProfile,
  OnboardingRequest,
  OnboardingResponse,
} from '../types'

const MOCK_PROFILE_KEY = 'restart-quest.mock-profile'

export function readMockProfile(): OnboardingProfile | null {
  const value = window.sessionStorage.getItem(MOCK_PROFILE_KEY)
  if (!value) return null

  try {
    return JSON.parse(value) as OnboardingProfile
  } catch {
    window.sessionStorage.removeItem(MOCK_PROFILE_KEY)
    return null
  }
}

function storeMockProfile(profile: OnboardingProfile): void {
  window.sessionStorage.setItem(MOCK_PROFILE_KEY, JSON.stringify(profile))
}

async function delay(): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, 180))
}

export const onboardingMockApi = {
  async getMe(accessToken: string | null): Promise<OnboardingResponse> {
    await delay()
    const user = requireMockUser(accessToken)
    const profile = readMockProfile()
    if (!profile || profile.userId !== user.id) {
      throw new ApiError(
        404,
        'ONBOARDING_NOT_FOUND',
        '작성한 정보가 없습니다.',
      )
    }
    return { profile, onboardingCompleted: true }
  },

  async upsert(
    input: OnboardingRequest,
    accessToken: string | null,
  ): Promise<OnboardingResponse> {
    await delay()
    const user = requireMockUser(accessToken)
    const profile: OnboardingProfile = {
      ...input,
      userId: user.id,
      updatedAt: new Date().toISOString(),
    }
    storeMockProfile(profile)
    markMockUserOnboarded(user)
    return { profile, onboardingCompleted: true }
  },
}
