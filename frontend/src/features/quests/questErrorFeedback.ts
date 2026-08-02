import { ApiError } from '../../shared/api/ApiError'

export interface QuestErrorFeedback {
  code: string
  title: string
  message: string
  source: 'load' | 'generate'
}

const ERROR_COPY: Record<string, Pick<QuestErrorFeedback, 'title' | 'message'>> = {
  AI_QUOTA_EXCEEDED: {
    title: '퀘스트 생성이 잠시 붐비고 있어요',
    message: '잠시 후 선택한 에너지 그대로 다시 시도해 주세요.',
  },
  AI_INVALID_RESPONSE: {
    title: '퀘스트 구성을 다시 확인해야 해요',
    message: '안전한 형식으로 준비하지 못했어요. 같은 선택으로 다시 만들 수 있어요.',
  },
  AI_PROVIDER_UNAVAILABLE: {
    title: '퀘스트 생성 서비스에 잠시 연결할 수 없어요',
    message: '입력은 그대로 두었어요. 잠시 후 다시 시도해 주세요.',
  },
  AI_PROVIDER_TIMEOUT: {
    title: '퀘스트를 준비하는 데 평소보다 오래 걸렸어요',
    message: '중복 생성되지 않으니 안심하고 다시 확인해 주세요.',
  },
  VALIDATION_ERROR: {
    title: '에너지 선택을 다시 확인해 주세요',
    message: '오늘 가능한 에너지 하나를 선택한 뒤 다시 시도해 주세요.',
  },
}

export function getQuestErrorFeedback(
  error: unknown,
  source: QuestErrorFeedback['source'],
): QuestErrorFeedback {
  const code = error instanceof ApiError ? error.code : 'REQUEST_FAILED'
  const copy = ERROR_COPY[code] ?? {
    title: source === 'load' ? '오늘 계획을 불러오지 못했어요' : '퀘스트를 만들지 못했어요',
    message: '잠시 후 다시 시도해 주세요.',
  }

  return { code, source, ...copy }
}
