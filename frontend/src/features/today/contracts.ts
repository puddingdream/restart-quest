import { isJsonRecord } from '../../lib/api/contracts'

export const energyLevels = ['LOW', 'MEDIUM', 'HIGH'] as const
export const availableMinutes = [5, 15, 30] as const
export const focusAreas = ['EXPLORE', 'RESUME', 'APPLY', 'INTERVIEW'] as const
export const barriers = [
  'TOO_LARGE',
  'NO_TIME',
  'LOW_ENERGY',
  'UNCLEAR',
  'EMOTIONAL_LOAD',
  'OTHER',
] as const

export type EnergyLevel = (typeof energyLevels)[number]
export type AvailableMinutes = (typeof availableMinutes)[number]
export type FocusArea = (typeof focusAreas)[number]
export type Barrier = (typeof barriers)[number]

export type CheckIn = {
  availableMinutes: AvailableMinutes
  energyLevel: EnergyLevel
  focusArea: FocusArea
}

export type Quest = {
  difficulty: number
  estimatedMinutes: number
  id: string
  predecessorQuestId: string | null
  reason: string
  title: string
  version: number
}

export type TodayPhase = 'CHECK_IN_REQUIRED' | 'QUEST_ACTIVE' | 'DAY_COMPLETED'

export type TodayView = {
  activeQuest: Quest | null
  checkIn: CheckIn | null
  completedQuest: Quest | null
  date: string
  phase: TodayPhase
}

export type CheckInInput = CheckIn

export type BlockQuestInput = {
  barrier: Barrier
  note?: string
  version: number
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/

function isOneOf<T extends readonly unknown[]>(value: unknown, values: T): value is T[number] {
  return values.includes(value)
}

function parseCheckIn(value: unknown): CheckIn | null {
  if (value === null) {
    return null
  }

  if (!isJsonRecord(value)) {
    throw new Error('체크인 응답 형식이 올바르지 않습니다.')
  }

  const { availableMinutes: minutes, energyLevel, focusArea } = value
  if (
    !isOneOf(minutes, availableMinutes) ||
    !isOneOf(energyLevel, energyLevels) ||
    !isOneOf(focusArea, focusAreas)
  ) {
    throw new Error('체크인 응답 형식이 올바르지 않습니다.')
  }

  return { availableMinutes: minutes, energyLevel, focusArea }
}

function parseQuest(value: unknown): Quest | null {
  if (value === null) {
    return null
  }

  if (!isJsonRecord(value)) {
    throw new Error('행동 응답 형식이 올바르지 않습니다.')
  }

  const {
    difficulty,
    estimatedMinutes,
    id,
    predecessorQuestId,
    reason,
    title,
    version,
  } = value

  if (
    typeof id !== 'string' ||
    typeof title !== 'string' ||
    typeof reason !== 'string' ||
    typeof estimatedMinutes !== 'number' ||
    !Number.isInteger(estimatedMinutes) ||
    estimatedMinutes < 0 ||
    typeof difficulty !== 'number' ||
    !Number.isInteger(difficulty) ||
    difficulty < 0 ||
    typeof version !== 'number' ||
    !Number.isInteger(version) ||
    version < 0 ||
    (predecessorQuestId !== null && typeof predecessorQuestId !== 'string')
  ) {
    throw new Error('행동 응답 형식이 올바르지 않습니다.')
  }

  return {
    difficulty,
    estimatedMinutes,
    id,
    predecessorQuestId,
    reason,
    title,
    version,
  }
}

export function parseTodayView(value: unknown): TodayView {
  if (!isJsonRecord(value)) {
    throw new Error('오늘 응답 형식이 올바르지 않습니다.')
  }

  const { activeQuest, checkIn, completedQuest, date, phase } = value
  if (
    typeof date !== 'string' ||
    !datePattern.test(date) ||
    !isOneOf(phase, ['CHECK_IN_REQUIRED', 'QUEST_ACTIVE', 'DAY_COMPLETED'] as const)
  ) {
    throw new Error('오늘 응답 형식이 올바르지 않습니다.')
  }

  const parsed = {
    activeQuest: parseQuest(activeQuest),
    checkIn: parseCheckIn(checkIn),
    completedQuest: parseQuest(completedQuest),
    date,
    phase,
  }

  if (
    (phase === 'CHECK_IN_REQUIRED' &&
      (parsed.checkIn !== null || parsed.activeQuest !== null || parsed.completedQuest !== null)) ||
    (phase === 'QUEST_ACTIVE' &&
      (parsed.checkIn === null || parsed.activeQuest === null || parsed.completedQuest !== null)) ||
    (phase === 'DAY_COMPLETED' &&
      (parsed.checkIn === null || parsed.activeQuest !== null || parsed.completedQuest === null))
  ) {
    throw new Error('오늘 상태와 세부 응답이 일치하지 않습니다.')
  }

  return parsed
}
