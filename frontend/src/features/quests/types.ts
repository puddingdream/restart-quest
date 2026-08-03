export const ENERGY_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const

export type EnergyLevel = (typeof ENERGY_LEVELS)[number]

export type QuestCategory =
  | 'RESUME'
  | 'JOB_SEARCH'
  | 'INTERVIEW'
  | 'LEARNING'
  | 'POLICY'
  | 'ROUTINE'

export type QuestDifficulty = 'EASY' | 'MEDIUM' | 'HARD'

export interface Quest {
  id: string
  title: string
  description: string
  completionCriteria: string
  steps: string[]
  category: QuestCategory
  difficulty: QuestDifficulty
  estimatedMinutes: number
  status: 'TODO' | 'DONE' | 'REDESIGNED'
  revision: number
}

export interface QuestJourney {
  journeyId: string
  status: 'ACTIVE' | 'COMPLETED'
  currentQuest: Quest
  history: Quest[]
}

export interface DailyQuestResponse {
  date: string
  energyLevel: EnergyLevel | null
  generatedNow: boolean
  journeys: QuestJourney[]
}

export interface GenerateDailyQuestRequest {
  energyLevel: EnergyLevel
}

export const ENERGY_LABELS: Record<EnergyLevel, string> = {
  LOW: '낮아요',
  MEDIUM: '보통이에요',
  HIGH: '충분해요',
}

export const CATEGORY_LABELS: Record<QuestCategory, string> = {
  RESUME: '이력서',
  JOB_SEARCH: '공고 탐색',
  INTERVIEW: '면접 준비',
  LEARNING: '직무 학습',
  POLICY: '지원 정보',
  ROUTINE: '준비 루틴',
}
