import type { DailyQuestResponse, QuestRedesign } from '../types'

const MOCK_DAILY_QUEST_KEY = 'restart-quest.mock-daily-quest'

export interface StoredDailyQuest {
  userId: string
  plan: DailyQuestResponse
  redesigns?: QuestRedesign[]
}

export function readStoredDailyQuest(): StoredDailyQuest | null {
  const value = window.sessionStorage.getItem(MOCK_DAILY_QUEST_KEY)
  if (!value) return null

  try {
    return JSON.parse(value) as StoredDailyQuest
  } catch {
    window.sessionStorage.removeItem(MOCK_DAILY_QUEST_KEY)
    return null
  }
}

export function saveStoredDailyQuest(stored: StoredDailyQuest): void {
  window.sessionStorage.setItem(MOCK_DAILY_QUEST_KEY, JSON.stringify(stored))
}

export function clearStoredDailyQuest(): void {
  window.sessionStorage.removeItem(MOCK_DAILY_QUEST_KEY)
}
