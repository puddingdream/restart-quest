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
  const strategy = redesignStrategy(input.reasonCode, originalQuest.title)
  const replacementQuest: Quest = {
    id: `${originalQuest.id}-r${originalQuest.revision + 1}`,
    title: strategy.title,
    description: strategy.description,
    completionCriteria: strategy.completionCriteria,
    steps: strategy.steps,
    category: originalQuest.category,
    difficulty: 'EASY',
    estimatedMinutes: Math.max(
      5,
      Math.min(strategy.maximumMinutes, originalQuest.estimatedMinutes),
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

interface MockRedesignStrategy {
  title: string
  description: string
  completionCriteria: string
  steps: string[]
  maximumMinutes: number
}

function redesignStrategy(
  reasonCode: RedesignQuestRequest['reasonCode'],
  originalTitle: string,
): MockRedesignStrategy {
  switch (reasonCode) {
    case 'TIME_SHORTAGE':
      return {
        title: `5분만 시작하기: ${originalTitle}`,
        description: '남은 시간 안에 끝낼 수 있는 한 단계만 진행해요.',
        completionCriteria: '가장 짧은 단계 하나를 5분 동안 실행하면 완료예요.',
        steps: ['타이머를 5분으로 맞추기', '가장 짧은 단계 하나 실행하기'],
        maximumMinutes: 5,
      }
    case 'TASK_TOO_LARGE':
      return {
        title: `한 조각만 끝내기: ${originalTitle}`,
        description: '전체 범위 대신 결과 한 개만 남기는 크기로 줄여요.',
        completionCriteria: '작은 결과 한 개를 저장하면 완료예요.',
        steps: ['해야 할 일을 세 조각으로 나누기', '첫 조각만 실행하기'],
        maximumMinutes: 10,
      }
    case 'START_POINT_UNCLEAR':
      return {
        title: `시작점 찾기: ${originalTitle}`,
        description: '무엇을 할지 결정하지 않고 첫 화면과 첫 문장만 정해요.',
        completionCriteria: '시작할 화면을 열고 첫 행동을 한 줄 적으면 완료예요.',
        steps: ['필요한 화면 하나 열기', '첫 행동 한 줄 적기'],
        maximumMinutes: 10,
      }
    case 'MATERIALS_MISSING':
      return {
        title: `준비물 하나 찾기: ${originalTitle}`,
        description: '실행에 필요한 자료를 모두 모으지 않고 한 개만 찾아요.',
        completionCriteria: '필요한 자료 한 개의 위치를 저장하면 완료예요.',
        steps: ['필요한 자료 목록 적기', '가장 찾기 쉬운 자료 하나 저장하기'],
        maximumMinutes: 10,
      }
    case 'LOW_ENERGY':
      return {
        title: `가볍게 열어보기: ${originalTitle}`,
        description: '오늘 가능한 에너지에 맞춰 읽거나 표시하는 행동만 해요.',
        completionCriteria: '관련 자료를 열고 한 곳을 표시하면 완료예요.',
        steps: ['관련 자료 열기', '눈에 들어오는 한 곳 표시하기'],
        maximumMinutes: 5,
      }
    case 'TASK_NOT_RELEVANT':
      return {
        title: '지금 필요한 다음 행동 고르기',
        description: '현재 목표와 가까운 행동 후보를 하나만 고릅니다.',
        completionCriteria: '지금 필요한 행동 한 개를 메모하면 완료예요.',
        steps: ['이번 주 목표 한 줄 확인하기', '가장 가까운 행동 하나 고르기'],
        maximumMinutes: 10,
      }
    case 'OTHER':
      return {
        title: `첫 단계만: ${originalTitle}`,
        description: '전체를 끝내지 않고 지금 가능한 첫 단계만 준비해요.',
        completionCriteria: '첫 단계 하나를 실행하면 완료예요.',
        steps: ['지금 가능한 첫 단계 하나만 실행하기'],
        maximumMinutes: 10,
      }
  }
}
