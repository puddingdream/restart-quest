import { ApiError, type FieldError } from '../../../shared/api/ApiError'
import {
  QUEST_FAILURE_REASONS,
  type DailyQuestResponse,
  type Quest,
  type QuestJourney,
  type QuestRedesign,
  type RedesignQuestRequest,
  type RedesignQuestResponse,
} from '../types'

export type MockQuestAiErrorCode =
  | 'AI_QUOTA_EXCEEDED'
  | 'AI_INVALID_RESPONSE'
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'AI_PROVIDER_TIMEOUT'

function findCurrentJourney(
  plan: DailyQuestResponse,
  questId: string,
): { journey: QuestJourney; index: number } {
  const index = plan.journeys.findIndex(
    ({ currentQuest }) => currentQuest.id === questId,
  )
  if (index < 0) {
    throw new ApiError(
      409,
      'QUEST_ALREADY_RESOLVED',
      '이미 처리된 퀘스트입니다.',
    )
  }

  const journey = plan.journeys[index]
  if (journey.status !== 'ACTIVE' || journey.currentQuest.status !== 'TODO') {
    throw new ApiError(
      409,
      'QUEST_ALREADY_RESOLVED',
      '이미 처리된 퀘스트입니다.',
    )
  }
  return { journey, index }
}

function replaceJourney(
  plan: DailyQuestResponse,
  index: number,
  journey: QuestJourney,
): DailyQuestResponse {
  return {
    ...plan,
    generatedNow: false,
    journeys: plan.journeys.map((current, currentIndex) =>
      currentIndex === index ? journey : current,
    ),
  }
}

export function completeMockQuest(
  plan: DailyQuestResponse,
  questId: string,
): { plan: DailyQuestResponse; journey: QuestJourney } {
  const { journey, index } = findCurrentJourney(plan, questId)
  const completedQuest: Quest = {
    ...journey.currentQuest,
    status: 'DONE',
  }
  const completedJourney: QuestJourney = {
    ...journey,
    status: 'COMPLETED',
    currentQuest: completedQuest,
    history: journey.history.map((quest) =>
      quest.id === completedQuest.id ? completedQuest : quest,
    ),
  }

  return {
    plan: replaceJourney(plan, index, completedJourney),
    journey: completedJourney,
  }
}

function readRedesignRequest(body: unknown): RedesignQuestRequest {
  const reasonCode = Reflect.get(Object(body), 'reasonCode')
  const reasonNote = Reflect.get(Object(body), 'reasonNote')
  const fieldErrors: FieldError[] = []

  if (!QUEST_FAILURE_REASONS.includes(reasonCode)) {
    fieldErrors.push({
      field: 'reasonCode',
      reason: '지원하는 이유 중 하나를 선택해 주세요.',
    })
  }
  if (
    reasonNote !== undefined &&
    (typeof reasonNote !== 'string' || reasonNote.length > 300)
  ) {
    fieldErrors.push({
      field: 'reasonNote',
      reason: '메모는 300자 이내로 적어 주세요.',
    })
  }
  if (fieldErrors.length > 0) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      '어려웠던 이유를 확인해 주세요.',
      fieldErrors,
    )
  }

  return {
    reasonCode: reasonCode as RedesignQuestRequest['reasonCode'],
    ...(typeof reasonNote === 'string' && reasonNote.trim()
      ? { reasonNote: reasonNote.trim() }
      : {}),
  }
}

export function throwMockQuestAiError(code: MockQuestAiErrorCode): never {
  const statusByCode: Record<MockQuestAiErrorCode, number> = {
    AI_QUOTA_EXCEEDED: 429,
    AI_INVALID_RESPONSE: 502,
    AI_PROVIDER_UNAVAILABLE: 503,
    AI_PROVIDER_TIMEOUT: 504,
  }
  throw new ApiError(
    statusByCode[code],
    code,
    '퀘스트 요청을 처리하지 못했습니다.',
  )
}

export function redesignMockQuest(
  plan: DailyQuestResponse,
  questId: string,
  body: unknown,
  nextAiError: MockQuestAiErrorCode | null,
): { plan: DailyQuestResponse; response: RedesignQuestResponse } {
  const input = readRedesignRequest(body)
  const { journey, index } = findCurrentJourney(plan, questId)
  if (nextAiError) throwMockQuestAiError(nextAiError)

  const originalQuest: Quest = {
    ...journey.currentQuest,
    status: 'REDESIGNED',
  }
  const replacementQuest: Quest = {
    id: `${originalQuest.id}-r${originalQuest.revision + 1}`,
    title: `첫 단계만: ${originalQuest.title}`,
    description: '전체를 끝내지 않고, 지금 가능한 첫 단계 하나만 준비해요.',
    completionCriteria: '필요한 화면이나 자료를 열고 첫 단계 하나를 적으면 완료예요.',
    steps: ['필요한 화면이나 자료 하나 열기', '지금 할 첫 단계 한 줄 적기'],
    category: originalQuest.category,
    difficulty: 'EASY',
    estimatedMinutes: Math.max(
      5,
      Math.min(15, originalQuest.estimatedMinutes - 5),
    ),
    status: 'TODO',
    revision: originalQuest.revision + 1,
  }
  const redesignedJourney: QuestJourney = {
    ...journey,
    currentQuest: replacementQuest,
    history: [
      ...journey.history,
      originalQuest,
    ],
  }
  const redesign: QuestRedesign = {
    id: `${journey.journeyId}-redesign-${replacementQuest.revision - 1}`,
    journeyId: journey.journeyId,
    originalQuestId: originalQuest.id,
    replacementQuestId: replacementQuest.id,
    reasonCode: input.reasonCode,
    ...(input.reasonNote ? { reasonNote: input.reasonNote } : {}),
    createdAt: new Date().toISOString(),
  }

  return {
    plan: replaceJourney(plan, index, redesignedJourney),
    response: { journey: redesignedJourney, redesign },
  }
}
