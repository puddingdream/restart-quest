import { apiRequest } from '../../../shared/api/apiRequest'
import { getAccessToken } from '../../../shared/auth/sessionToken'
import type {
  DailyQuestResponse,
  GenerateDailyQuestRequest,
} from '../types'
import { questMockApi } from './questMockApi'

function usesFeatureMock(): boolean {
  const apiMode =
    import.meta.env?.VITE_API_MODE ??
    document
      .querySelector<HTMLMetaElement>('meta[name="restart-quest-api-mode"]')
      ?.getAttribute('content')

  return apiMode !== 'http'
}

export const questApi = {
  getToday() {
    if (usesFeatureMock()) return questMockApi.getToday(getAccessToken())
    return apiRequest<DailyQuestResponse>('/quests/today')
  },
  generate(input: GenerateDailyQuestRequest) {
    if (usesFeatureMock()) {
      return questMockApi.generate(input, getAccessToken())
    }
    return apiRequest<DailyQuestResponse>('/quests/today/generate', {
      method: 'POST',
      body: input,
    })
  },
}
