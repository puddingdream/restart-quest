import { ApiError } from './ApiError'
import type { AuthResponse, AuthUser } from '../../features/auth/types'
import type {
  OnboardingProfile,
  OnboardingRequest,
  OnboardingResponse,
} from '../../features/onboarding/types'

const MOCK_USER_KEY = 'restart-quest.mock-user'
const MOCK_PROFILE_KEY = 'restart-quest.mock-profile'

interface MockRequestOptions {
  method: string
  body?: unknown
  accessToken: string | null
}

function readSessionValue<T>(key: string): T | null {
  const value = window.sessionStorage.getItem(key)
  if (!value) return null

  try {
    return JSON.parse(value) as T
  } catch {
    window.sessionStorage.removeItem(key)
    return null
  }
}

function storeSessionValue(key: string, value: unknown): void {
  window.sessionStorage.setItem(key, JSON.stringify(value))
}

function requireUser(accessToken: string | null): AuthUser {
  const user = readSessionValue<AuthUser>(MOCK_USER_KEY)
  if (!accessToken || !user) {
    throw new ApiError(401, 'SESSION_EXPIRED', '다시 로그인해 주세요.')
  }

  return user
}

async function delay(): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, 180))
}

function createAccessToken(): string {
  return `mock-session-${crypto.randomUUID()}`
}

function signup(body: unknown): AuthResponse {
  const input = body as { email: string; name: string }
  if (input.email.toLowerCase() === 'taken@example.com') {
    throw new ApiError(409, 'EMAIL_ALREADY_EXISTS', '이미 사용 중인 이메일입니다.')
  }

  const user: AuthUser = {
    id: crypto.randomUUID(),
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    onboardingCompleted: false,
  }
  storeSessionValue(MOCK_USER_KEY, user)
  window.sessionStorage.removeItem(MOCK_PROFILE_KEY)
  return { accessToken: createAccessToken(), user }
}

function login(body: unknown): AuthResponse {
  const input = body as { email: string }
  if (input.email.toLowerCase() === 'error@example.com') {
    throw new ApiError(401, 'INVALID_CREDENTIALS', '로그인 정보를 확인해 주세요.')
  }

  const storedUser = readSessionValue<AuthUser>(MOCK_USER_KEY)
  const isSameUser = storedUser?.email === input.email.trim().toLowerCase()
  const user: AuthUser = isSameUser
    ? storedUser
    : {
        id: crypto.randomUUID(),
        email: input.email.trim().toLowerCase(),
        name: '다시 시작하는 사람',
        onboardingCompleted: input.email.toLowerCase() === 'ready@example.com',
      }
  storeSessionValue(MOCK_USER_KEY, user)
  return { accessToken: createAccessToken(), user }
}

function upsertOnboarding(
  body: unknown,
  accessToken: string | null,
): OnboardingResponse {
  const user = requireUser(accessToken)
  const input = body as OnboardingRequest
  const profile: OnboardingProfile = {
    ...input,
    userId: user.id,
    updatedAt: new Date().toISOString(),
  }
  storeSessionValue(MOCK_PROFILE_KEY, profile)
  storeSessionValue(MOCK_USER_KEY, { ...user, onboardingCompleted: true })
  return { profile, onboardingCompleted: true }
}

export async function mockRequest<T>(
  path: string,
  options: MockRequestOptions,
): Promise<T> {
  await delay()
  const route = `${options.method} ${path}`

  if (route === 'POST /auth/signup') return signup(options.body) as T
  if (route === 'POST /auth/login') return login(options.body) as T
  if (route === 'GET /users/me') return requireUser(options.accessToken) as T
  if (route === 'GET /onboarding/me') {
    requireUser(options.accessToken)
    const profile = readSessionValue<OnboardingProfile>(MOCK_PROFILE_KEY)
    if (!profile) {
      throw new ApiError(404, 'ONBOARDING_NOT_FOUND', '작성한 정보가 없습니다.')
    }
    return { profile, onboardingCompleted: true } as T
  }
  if (route === 'PUT /onboarding/me') {
    return upsertOnboarding(options.body, options.accessToken) as T
  }

  throw new ApiError(404, 'NOT_FOUND', '요청한 기능을 찾을 수 없습니다.')
}

export function clearMockSession(): void {
  window.sessionStorage.removeItem(MOCK_USER_KEY)
  window.sessionStorage.removeItem(MOCK_PROFILE_KEY)
}
