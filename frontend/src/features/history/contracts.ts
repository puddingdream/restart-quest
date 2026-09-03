import { isJsonRecord } from '../../lib/api/contracts'
import {
  barriers,
  type Barrier,
  type CheckIn,
  type Quest,
} from '../today/contracts'

export type HistoryOutcome = {
  barrier: Barrier | null
  createdAt: string
  note: string | null
  quest: Pick<Quest, 'difficulty' | 'estimatedMinutes' | 'id' | 'title'>
  type: 'BLOCKED' | 'COMPLETED'
}

export type HistoryDay = {
  checkIn: CheckIn
  date: string
  outcomes: HistoryOutcome[]
}

export type HistoryView = {
  days: HistoryDay[]
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/

function isBarrier(value: unknown): value is Barrier {
  return barriers.includes(value as Barrier)
}

function parseCheckIn(value: unknown): CheckIn {
  if (!isJsonRecord(value)) {
    throw new Error('기록 체크인 형식이 올바르지 않습니다.')
  }

  const { availableMinutes, energyLevel, focusArea } = value
  if (
    ![5, 15, 30].includes(availableMinutes as number) ||
    !['LOW', 'MEDIUM', 'HIGH'].includes(energyLevel as string) ||
    !['EXPLORE', 'RESUME', 'APPLY', 'INTERVIEW'].includes(focusArea as string)
  ) {
    throw new Error('기록 체크인 형식이 올바르지 않습니다.')
  }

  return { availableMinutes, energyLevel, focusArea } as CheckIn
}

function parseOutcome(value: unknown): HistoryOutcome {
  if (!isJsonRecord(value) || !isJsonRecord(value.quest)) {
    throw new Error('행동 기록 형식이 올바르지 않습니다.')
  }

  const { barrier, createdAt, note, quest, type } = value
  const { difficulty, estimatedMinutes, id, title } = quest
  if (
    !['BLOCKED', 'COMPLETED'].includes(type as string) ||
    typeof createdAt !== 'string' ||
    Number.isNaN(Date.parse(createdAt)) ||
    (barrier !== null && !isBarrier(barrier)) ||
    (note !== null && typeof note !== 'string') ||
    typeof id !== 'string' ||
    typeof title !== 'string' ||
    typeof difficulty !== 'number' ||
    !Number.isInteger(difficulty) ||
    typeof estimatedMinutes !== 'number' ||
    !Number.isInteger(estimatedMinutes)
  ) {
    throw new Error('행동 기록 형식이 올바르지 않습니다.')
  }

  if ((type === 'BLOCKED' && !isBarrier(barrier)) || (type === 'COMPLETED' && barrier !== null)) {
    throw new Error('행동 결과와 막힌 이유가 일치하지 않습니다.')
  }

  return {
    barrier,
    createdAt,
    note,
    quest: { difficulty, estimatedMinutes, id, title },
    type,
  } as HistoryOutcome
}

export function parseHistoryView(value: unknown): HistoryView {
  if (!isJsonRecord(value) || !Array.isArray(value.days)) {
    throw new Error('기록 응답 형식이 올바르지 않습니다.')
  }

  return {
    days: value.days.map((day) => {
      if (
        !isJsonRecord(day) ||
        typeof day.date !== 'string' ||
        !datePattern.test(day.date) ||
        !Array.isArray(day.outcomes)
      ) {
        throw new Error('날짜별 기록 형식이 올바르지 않습니다.')
      }

      return {
        checkIn: parseCheckIn(day.checkIn),
        date: day.date,
        outcomes: day.outcomes.map(parseOutcome),
      }
    }),
  }
}
