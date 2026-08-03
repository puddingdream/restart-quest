export const ENERGY_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const

export const QUEST_FAILURE_REASONS = [
  'TIME_SHORTAGE',
  'TASK_TOO_LARGE',
  'START_POINT_UNCLEAR',
  'MATERIALS_MISSING',
  'LOW_ENERGY',
  'TASK_NOT_RELEVANT',
  'OTHER',
] as const

export type EnergyLevel = (typeof ENERGY_LEVELS)[number]

export type QuestFailureReasonCode = (typeof QUEST_FAILURE_REASONS)[number]

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

export interface RedesignQuestRequest {
  reasonCode: QuestFailureReasonCode
  reasonNote?: string
}

export interface QuestRedesign {
  id: string
  journeyId: string
  originalQuestId: string
  replacementQuestId: string
  reasonCode: QuestFailureReasonCode
  reasonNote?: string
  createdAt: string
}

export interface RedesignQuestResponse {
  journey: QuestJourney
  redesign: QuestRedesign
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

export const QUEST_FAILURE_REASON_LABELS: Record<
  QuestFailureReasonCode,
  string
> = {
  TIME_SHORTAGE: '오늘 쓸 시간이 부족했어요',
  TASK_TOO_LARGE: '한 번에 하기에는 범위가 컸어요',
  START_POINT_UNCLEAR: '어디서 시작할지 정하기 어려웠어요',
  MATERIALS_MISSING: '필요한 자료가 아직 없어요',
  LOW_ENERGY: '오늘 가능한 에너지가 적었어요',
  TASK_NOT_RELEVANT: '지금 필요한 행동과 거리가 있어요',
  OTHER: '다른 이유가 있어요',
}
