import { ApiError } from '../../shared/api/ApiError'

export interface QuestOutcomeErrorFeedback {
  code: string
  title: string
  message: string
  action: 'retry' | 'refresh'
  source: 'completion' | 'redesign'
}

const REDESIGN_ERROR_COPY: Record<
  string,
  Pick<QuestOutcomeErrorFeedback, 'title' | 'message' | 'action'>
> = {
  AI_QUOTA_EXCEEDED: {
    title: '더 작은 행동을 준비하는 요청이 잠시 붐비고 있어요',
    message: '선택한 이유와 메모는 그대로 두었어요. 잠시 후 다시 시도해 주세요.',
    action: 'retry',
  },
  AI_INVALID_RESPONSE: {
    title: '더 작은 행동의 구성을 다시 확인해야 해요',
    message: '입력은 그대로 두었어요. 같은 내용으로 다시 요청할 수 있어요.',
    action: 'retry',
  },
  AI_PROVIDER_UNAVAILABLE: {
    title: '더 작은 행동을 준비하는 서비스에 잠시 연결할 수 없어요',
    message: '선택한 내용은 유지했어요. 잠시 후 다시 시도해 주세요.',
    action: 'retry',
  },
  AI_PROVIDER_TIMEOUT: {
    title: '더 작은 행동을 준비하는 데 평소보다 오래 걸렸어요',
    message: '선택한 내용은 유지했어요. 잠시 후 다시 시도해 주세요.',
    action: 'retry',
  },
  VALIDATION_ERROR: {
    title: '입력한 이유를 다시 확인해 주세요',
    message: '이유를 하나 선택하고 메모는 300자 이내로 적어 주세요.',
    action: 'retry',
  },
}

export function getQuestOutcomeErrorFeedback(
  error: unknown,
  source: QuestOutcomeErrorFeedback['source'],
): QuestOutcomeErrorFeedback {
  const code = error instanceof ApiError ? error.code : 'REQUEST_FAILED'
  if (code === 'QUEST_ALREADY_RESOLVED') {
    return {
      code,
      source,
      title: '이 퀘스트의 상태가 이미 바뀌었어요',
      message: '오늘 목록을 다시 확인하면 최신 상태를 볼 수 있어요.',
      action: 'refresh',
    }
  }

  const copy = REDESIGN_ERROR_COPY[code] ?? {
    title:
      source === 'completion'
        ? '완료 상태를 반영하지 못했어요'
        : '더 작은 행동으로 바꾸지 못했어요',
    message: '입력한 내용은 유지했어요. 잠시 후 다시 시도해 주세요.',
    action: 'retry' as const,
  }
  return { code, source, ...copy }
}
