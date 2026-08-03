import { ApiError } from './ApiError'
import type { AuthResponse, AuthUser } from '../../features/auth/types'
import type {
  OnboardingProfile,
  OnboardingRequest,
  OnboardingResponse,
} from '../../features/onboarding/types'
import type {
  DashboardQuestSummary,
  TodayDashboardResponse,
} from '../../features/dashboard/types'

const MOCK_USER_KEY = 'restart-quest.mock-user'
const MOCK_PROFILE_KEY = 'restart-quest.mock-profile'

interface MockRequestOptions {
  method: string
  body?: unknown
  accessToken: string | null
  now?: Date
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

function getSeoulDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function createPastDemoTimestamp(
  now: Date,
  date: string,
  minutesAgo: number,
): string {
  const dayStartedAt = new Date(`${date}T00:00:00+09:00`).getTime()
  const timestamp = Math.max(dayStartedAt, now.getTime() - minutesAgo * 60_000)
  return new Date(timestamp).toISOString()
}

function createDemoDashboard(now: Date): TodayDashboardResponse {
  const date = getSeoulDate(now)
  const nextQuest: DashboardQuestSummary = {
    journeyId: `${date}-journey-2`,
    questId: `${date}-quest-2-revision-2`,
    title: '관심 공고의 자격 요건 한 줄 표시하기',
    category: 'JOB_SEARCH',
    estimatedMinutes: 10,
  }

  return {
    date,
    totalJourneys: 3,
    completedJourneys: [
      {
        journeyId: `${date}-journey-1`,
        questId: `${date}-quest-1`,
        title: '이력서 경험 문장 하나 다듬기',
        category: 'RESUME',
        estimatedMinutes: 15,
        completedAt: createPastDemoTimestamp(now, date, 45),
      },
    ],
    activeJourneys: [
      nextQuest,
      {
        journeyId: `${date}-journey-3`,
        questId: `${date}-quest-3`,
        title: '면접 답변의 첫 문장 준비하기',
        category: 'INTERVIEW',
        estimatedMinutes: 20,
      },
    ],
    redesignCount: 1,
    progressPercent: 33,
    nextQuest,
    recentRedesigns: [
      {
        redesignId: `${date}-redesign-1`,
        journeyId: `${date}-journey-2`,
        originalQuestTitle: '관심 공고 한 개 살펴보기',
        replacementQuestTitle: nextQuest.title,
        reasonCode: 'TIME_SHORTAGE',
        createdAt: createPastDemoTimestamp(now, date, 15),
      },
    ],
  }
}

function getTodayDashboard(
  accessToken: string | null,
  now: Date = new Date(),
): TodayDashboardResponse {
  const user = requireUser(accessToken)
  if (user.email === 'ready@example.com') return createDemoDashboard(now)

  return {
    date: getSeoulDate(now),
    totalJourneys: 0,
    completedJourneys: [],
    activeJourneys: [],
    redesignCount: 0,
    progressPercent: 0,
    nextQuest: null,
    recentRedesigns: [],
  }
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
  if (route === 'GET /dashboard/today') {
    return getTodayDashboard(options.accessToken, options.now) as T
  }

  throw new ApiError(404, 'NOT_FOUND', '요청한 기능을 찾을 수 없습니다.')
}

export function clearMockSession(): void {
  window.sessionStorage.removeItem(MOCK_USER_KEY)
  window.sessionStorage.removeItem(MOCK_PROFILE_KEY)
}
