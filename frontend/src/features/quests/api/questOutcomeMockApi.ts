import { ApiError } from '../../../shared/api/ApiError'
import type { AuthUser } from '../../auth/types'
import {
  completeMockQuest,
  redesignMockQuest,
  type MockQuestAiErrorCode,
} from './mockQuestOutcomes'
import type {
  DailyQuestResponse,
  QuestJourney,
  RedesignQuestRequest,
  RedesignQuestResponse,
} from '../types'

const MOCK_USER_KEY = 'restart-quest.mock-user'
const MOCK_DAILY_QUEST_KEY = 'restart-quest.mock-daily-quest'
const MOCK_NEXT_QUEST_ERROR_KEY = 'restart-quest.mock-next-quest-error'

interface StoredDailyQuest {
  userId: string
  plan: DailyQuestResponse
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

function getSeoulDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

async function delay(): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, 180))
}

function requireStoredPlan(accessToken: string | null): StoredDailyQuest {
  const user = readSessionValue<AuthUser>(MOCK_USER_KEY)
  if (!accessToken || !user) {
    throw new ApiError(401, 'SESSION_EXPIRED', '다시 로그인해 주세요.')
  }

  const stored = readSessionValue<StoredDailyQuest>(MOCK_DAILY_QUEST_KEY)
  if (
    !stored ||
    stored.userId !== user.id ||
    stored.plan.date !== getSeoulDate()
  ) {
    throw new ApiError(
      404,
      'QUEST_NOT_FOUND',
      '오늘의 퀘스트를 찾을 수 없습니다.',
    )
  }
  return stored
}

function savePlan(stored: StoredDailyQuest, plan: DailyQuestResponse): void {
  storeSessionValue(MOCK_DAILY_QUEST_KEY, { ...stored, plan })
}

export const questOutcomeMockApi = {
  async complete(
    questId: string,
    accessToken: string | null,
  ): Promise<QuestJourney> {
    await delay()
    const stored = requireStoredPlan(accessToken)
    const result = completeMockQuest(stored.plan, questId)
    savePlan(stored, result.plan)
    return result.journey
  },

  async redesign(
    questId: string,
    input: RedesignQuestRequest,
    accessToken: string | null,
  ): Promise<RedesignQuestResponse> {
    await delay()
    const stored = requireStoredPlan(accessToken)
    const nextError = readSessionValue<MockQuestAiErrorCode>(
      MOCK_NEXT_QUEST_ERROR_KEY,
    )
    if (nextError) window.sessionStorage.removeItem(MOCK_NEXT_QUEST_ERROR_KEY)

    const result = redesignMockQuest(stored.plan, questId, input, nextError)
    savePlan(stored, result.plan)
    return result.response
  },
}

export function queueMockQuestOutcomeAiError(
  code: MockQuestAiErrorCode,
): void {
  storeSessionValue(MOCK_NEXT_QUEST_ERROR_KEY, code)
}
