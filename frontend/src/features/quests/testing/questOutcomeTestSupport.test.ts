import {
  authMockApi,
  clearAuthMockSession,
} from '../../auth/api/authMockApi'
import { clearQuestMockSession } from '../api/questMockApi'
import type { DailyQuestResponse } from '../types'

const MOCK_DAILY_QUEST_KEY = 'restart-quest.mock-daily-quest'

class MemoryStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }

  removeItem(key: string) {
    this.values.delete(key)
  }
}

export function installOutcomeTestWindow(): void {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      sessionStorage: new MemoryStorage(),
      setTimeout,
    },
  })
}

function getSeoulDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export async function createOutcomeSession(
  email: string,
  plan: DailyQuestResponse,
) {
  clearAuthMockSession()
  clearQuestMockSession()
  const auth = await authMockApi.signup({
    email,
    password: 'password123',
    name: '테스트 사용자',
  })
  const storedPlan = { ...plan, date: getSeoulDate() }
  window.sessionStorage.setItem(
    MOCK_DAILY_QUEST_KEY,
    JSON.stringify({ userId: auth.user.id, plan: storedPlan }),
  )
  return { accessToken: auth.accessToken, storedPlan }
}

export function readStoredPlan(): DailyQuestResponse {
  const stored = JSON.parse(
    window.sessionStorage.getItem(MOCK_DAILY_QUEST_KEY) ?? '{}',
  ) as { plan: DailyQuestResponse }
  return stored.plan
}
