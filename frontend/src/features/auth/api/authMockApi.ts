import { ApiError } from '../../../shared/api/ApiError'
import type { AuthResponse, AuthUser, LoginInput, SignupInput } from '../types'

const MOCK_USER_KEY = 'restart-quest.mock-user'

function readMockUser(): AuthUser | null {
  const value = window.sessionStorage.getItem(MOCK_USER_KEY)
  if (!value) return null

  try {
    return JSON.parse(value) as AuthUser
  } catch {
    window.sessionStorage.removeItem(MOCK_USER_KEY)
    return null
  }
}

function storeMockUser(user: AuthUser): void {
  window.sessionStorage.setItem(MOCK_USER_KEY, JSON.stringify(user))
}

async function delay(): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, 180))
}

function createAccessToken(): string {
  return `mock-session-${crypto.randomUUID()}`
}

export function requireMockUser(accessToken: string | null): AuthUser {
  const user = readMockUser()
  if (!accessToken || !user) {
    throw new ApiError(401, 'SESSION_EXPIRED', '다시 로그인해 주세요.')
  }
  return user
}

export function markMockUserOnboarded(user: AuthUser): void {
  storeMockUser({ ...user, onboardingCompleted: true })
}

export function clearAuthMockSession(): void {
  window.sessionStorage.removeItem(MOCK_USER_KEY)
}

export const authMockApi = {
  async signup(input: SignupInput): Promise<AuthResponse> {
    await delay()
    if (input.email.toLowerCase() === 'taken@example.com') {
      throw new ApiError(
        409,
        'EMAIL_ALREADY_EXISTS',
        '이미 사용 중인 이메일입니다.',
      )
    }

    const user: AuthUser = {
      id: crypto.randomUUID(),
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
      onboardingCompleted: false,
    }
    storeMockUser(user)
    return { accessToken: createAccessToken(), user }
  },

  async login(input: LoginInput): Promise<AuthResponse> {
    await delay()
    if (input.email.toLowerCase() === 'error@example.com') {
      throw new ApiError(
        401,
        'INVALID_CREDENTIALS',
        '로그인 정보를 확인해 주세요.',
      )
    }

    const normalizedEmail = input.email.trim().toLowerCase()
    const storedUser = readMockUser()
    const user: AuthUser =
      storedUser?.email === normalizedEmail
        ? storedUser
        : {
            id: crypto.randomUUID(),
            email: normalizedEmail,
            name: '다시 시작하는 사람',
            onboardingCompleted: normalizedEmail === 'ready@example.com',
          }
    storeMockUser(user)
    return { accessToken: createAccessToken(), user }
  },

  async me(accessToken: string | null): Promise<AuthUser> {
    await delay()
    return requireMockUser(accessToken)
  },
}
