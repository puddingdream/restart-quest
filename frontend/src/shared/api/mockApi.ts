import { ApiError } from './ApiError'
import type { AuthResponse, AuthUser } from '../../features/auth/types'
import type {
  OnboardingProfile,
  OnboardingRequest,
  OnboardingResponse,
} from '../../features/onboarding/types'
import {
  ENERGY_LEVELS,
  type DailyQuestResponse,
  type EnergyLevel,
  type Quest,
  type QuestJourney,
} from '../../features/quests/types'

const MOCK_USER_KEY = 'restart-quest.mock-user'
const MOCK_PROFILE_KEY = 'restart-quest.mock-profile'
const MOCK_DAILY_QUEST_KEY = 'restart-quest.mock-daily-quest'
const MOCK_NEXT_QUEST_ERROR_KEY = 'restart-quest.mock-next-quest-error'

type MockQuestAiErrorCode =
  | 'AI_QUOTA_EXCEEDED'
  | 'AI_INVALID_RESPONSE'
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'AI_PROVIDER_TIMEOUT'

interface StoredDailyQuest {
  userId: string
  plan: DailyQuestResponse
}

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
  window.sessionStorage.removeItem(MOCK_DAILY_QUEST_KEY)
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

function getSeoulDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function createQuest(
  date: string,
  position: number,
  input: Omit<Quest, 'id' | 'revision' | 'status'>,
): Quest {
  return {
    id: `${date}-quest-${position}`,
    revision: 1,
    status: 'TODO',
    ...input,
  }
}

function createDailyQuests(energyLevel: EnergyLevel): DailyQuestResponse {
  const date = getSeoulDate()
  const minuteOffset = energyLevel === 'LOW' ? -5 : energyLevel === 'HIGH' ? 5 : 0
  const quests = [
    createQuest(date, 1, {
      title: '이력서 한 문장 선명하게 다듬기',
      description: '최근 경험 하나를 골라 맡은 역할과 결과가 드러나도록 정리해요.',
      completionCriteria: '이력서 경험 항목의 문장 하나를 수정해 저장하면 완료예요.',
      steps: ['수정할 경험 한 개 고르기', '행동과 결과를 한 문장으로 적기', '이력서에 반영해 저장하기'],
      category: 'RESUME',
      difficulty: energyLevel === 'HIGH' ? 'MEDIUM' : 'EASY',
      estimatedMinutes: 15 + minuteOffset,
    }),
    createQuest(date, 2, {
      title: '관심 공고 한 개 살펴보기',
      description: '지원 결정을 서두르지 않고, 관심 가는 공고에서 핵심 조건만 찾아봐요.',
      completionCriteria: '공고 한 개와 눈에 들어온 자격 요건 한 줄을 메모하면 완료예요.',
      steps: ['저장했거나 더미로 제공된 공고 열기', '자격 요건 한 줄 표시하기'],
      category: 'JOB_SEARCH',
      difficulty: 'EASY',
      estimatedMinutes: 15 + minuteOffset,
    }),
    createQuest(date, 3, {
      title: '면접 답변의 첫 문장 준비하기',
      description: '자주 받는 질문 하나에 길지 않은 첫 문장만 준비해요.',
      completionCriteria: '질문 하나와 답변의 첫 문장을 소리 내어 한 번 읽으면 완료예요.',
      steps: ['예상 질문 한 개 고르기', '답변의 첫 문장 적기', '천천히 한 번 읽기'],
      category: 'INTERVIEW',
      difficulty: energyLevel === 'LOW' ? 'EASY' : 'MEDIUM',
      estimatedMinutes: 20 + minuteOffset,
    }),
  ]
  const journeys: QuestJourney[] = quests.map((quest, index) => ({
    journeyId: `${date}-journey-${index + 1}`,
    status: 'ACTIVE',
    currentQuest: quest,
    history: [quest],
  }))

  return { date, energyLevel, generatedNow: true, journeys }
}

function getTodayQuests(accessToken: string | null): DailyQuestResponse {
  const user = requireUser(accessToken)
  const date = getSeoulDate()
  const stored = readSessionValue<StoredDailyQuest>(MOCK_DAILY_QUEST_KEY)
  if (!stored || stored.userId !== user.id || stored.plan.date !== date) {
    return { date, energyLevel: null, generatedNow: false, journeys: [] }
  }
  return { ...stored.plan, generatedNow: false }
}

function generateTodayQuests(
  body: unknown,
  accessToken: string | null,
): DailyQuestResponse {
  const user = requireUser(accessToken)
  if (!user.onboardingCompleted) {
    throw new ApiError(409, 'ONBOARDING_REQUIRED', '온보딩을 먼저 완료해 주세요.')
  }

  const energyLevel = Reflect.get(Object(body), 'energyLevel')
  if (!ENERGY_LEVELS.includes(energyLevel as EnergyLevel)) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      '에너지 수준을 확인해 주세요.',
      [{ field: 'energyLevel', reason: 'LOW, MEDIUM, HIGH 중 하나를 선택해 주세요.' }],
    )
  }

  const existingPlan = getTodayQuests(accessToken)
  if (existingPlan.journeys.length > 0) return existingPlan

  const nextError = readSessionValue<MockQuestAiErrorCode>(
    MOCK_NEXT_QUEST_ERROR_KEY,
  )
  if (nextError) {
    window.sessionStorage.removeItem(MOCK_NEXT_QUEST_ERROR_KEY)
    const statusByCode: Record<MockQuestAiErrorCode, number> = {
      AI_QUOTA_EXCEEDED: 429,
      AI_INVALID_RESPONSE: 502,
      AI_PROVIDER_UNAVAILABLE: 503,
      AI_PROVIDER_TIMEOUT: 504,
    }
    throw new ApiError(statusByCode[nextError], nextError, '퀘스트 생성 요청을 처리하지 못했습니다.')
  }

  const plan = createDailyQuests(energyLevel as EnergyLevel)
  storeSessionValue(MOCK_DAILY_QUEST_KEY, { userId: user.id, plan })
  return plan
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
  if (route === 'GET /quests/today') {
    return getTodayQuests(options.accessToken) as T
  }
  if (route === 'POST /quests/today/generate') {
    return generateTodayQuests(options.body, options.accessToken) as T
  }

  throw new ApiError(404, 'NOT_FOUND', '요청한 기능을 찾을 수 없습니다.')
}

export function clearMockSession(): void {
  window.sessionStorage.removeItem(MOCK_USER_KEY)
  window.sessionStorage.removeItem(MOCK_PROFILE_KEY)
  window.sessionStorage.removeItem(MOCK_DAILY_QUEST_KEY)
  window.sessionStorage.removeItem(MOCK_NEXT_QUEST_ERROR_KEY)
}

export function queueMockQuestAiError(code: MockQuestAiErrorCode): void {
  storeSessionValue(MOCK_NEXT_QUEST_ERROR_KEY, code)
}
