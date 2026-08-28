import type { AuthUser } from '../../auth/types'
import { requireMockUser } from '../../auth/api/authMockApi'
import { readMockProfile } from '../../onboarding/api/onboardingMockApi'
import { ApiError } from '../../../shared/api/ApiError'
import {
  clearStoredDailyQuest,
  readStoredDailyQuest,
  saveStoredDailyQuest,
} from './questMockStore'
import {
  ENERGY_LEVELS,
  type DailyQuestResponse,
  type EnergyLevel,
  type GenerateDailyQuestRequest,
  type Quest,
  type QuestJourney,
} from '../types'

const MOCK_NEXT_QUEST_ERROR_KEY = 'restart-quest.mock-next-quest-error'

export type MockQuestAiErrorCode =
  | 'AI_QUOTA_EXCEEDED'
  | 'AI_INVALID_RESPONSE'
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'AI_PROVIDER_TIMEOUT'

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

function createDailyQuests(
  energyLevel: EnergyLevel,
  hasResume: boolean,
): DailyQuestResponse {
  const date = getSeoulDate()
  const minuteOffset = energyLevel === 'LOW' ? -5 : energyLevel === 'HIGH' ? 5 : 0
  const quests = [
    createQuest(date, 1, {
      title: hasResume
        ? '이력서 한 문장 선명하게 다듬기'
        : '이력서에 넣을 경험 하나 고르기',
      description: hasResume
        ? '최근 경험 하나를 골라 맡은 역할과 결과가 드러나도록 정리해요.'
        : '아직 이력서가 없어도 괜찮아요. 먼저 적어볼 경험 하나만 골라요.',
      completionCriteria: hasResume
        ? '이력서 경험 항목의 문장 하나를 수정해 저장하면 완료예요.'
        : '이력서에 넣고 싶은 경험 이름 하나를 메모하면 완료예요.',
      steps: hasResume
        ? [
            '수정할 경험 한 개 고르기',
            '행동과 결과를 한 문장으로 적기',
            '이력서에 반영해 저장하기',
          ]
        : ['기억나는 경험 세 개 적기', '지금 설명하기 쉬운 경험 하나 표시하기'],
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

function findTodayPlan(userId: string): DailyQuestResponse {
  const date = getSeoulDate()
  const stored = readStoredDailyQuest()
  if (!stored || stored.userId !== userId || stored.plan.date !== date) {
    return { date, energyLevel: null, generatedNow: false, journeys: [] }
  }
  return { ...stored.plan, generatedNow: false }
}

async function requireUser(accessToken: string | null): Promise<AuthUser> {
  return requireMockUser(accessToken)
}

export const questMockApi = {
  async getToday(accessToken: string | null): Promise<DailyQuestResponse> {
    const user = await requireUser(accessToken)
    return findTodayPlan(user.id)
  },

  async generate(
    input: GenerateDailyQuestRequest,
    accessToken: string | null,
  ): Promise<DailyQuestResponse> {
    const user = await requireUser(accessToken)
    if (!user.onboardingCompleted) {
      throw new ApiError(409, 'ONBOARDING_REQUIRED', '온보딩을 먼저 완료해 주세요.')
    }

    if (!ENERGY_LEVELS.includes(input.energyLevel)) {
      throw new ApiError(400, 'VALIDATION_ERROR', '에너지 수준을 확인해 주세요.', [
        {
          field: 'energyLevel',
          reason: 'LOW, MEDIUM, HIGH 중 하나를 선택해 주세요.',
        },
      ])
    }

    const existingPlan = findTodayPlan(user.id)
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
      throw new ApiError(
        statusByCode[nextError],
        nextError,
        '퀘스트 생성 요청을 처리하지 못했습니다.',
      )
    }

    const profile = readMockProfile()
    const plan = createDailyQuests(
      input.energyLevel,
      profile?.userId === user.id ? profile.hasResume : false,
    )
    saveStoredDailyQuest({ userId: user.id, plan, redesigns: [] })
    return plan
  },
}

export function clearQuestMockSession(): void {
  clearStoredDailyQuest()
  window.sessionStorage.removeItem(MOCK_NEXT_QUEST_ERROR_KEY)
}

export function queueMockQuestAiError(code: MockQuestAiErrorCode): void {
  storeSessionValue(MOCK_NEXT_QUEST_ERROR_KEY, code)
}
