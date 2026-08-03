import { apiRequest } from '../../../shared/api/apiRequest'
import { getAccessToken } from '../../../shared/auth/sessionToken'
import type {
  DailyQuestResponse,
  GenerateDailyQuestRequest,
  QuestJourney,
  RedesignQuestRequest,
  RedesignQuestResponse,
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
  complete(questId: string) {
    return apiRequest<QuestJourney>(`/quests/${questId}/completion`, {
      method: 'POST',
    })
  },
  redesign(questId: string, input: RedesignQuestRequest) {
    return apiRequest<RedesignQuestResponse>(
      `/quests/${questId}/failure-redesign`,
      { method: 'POST', body: input },
    )
  },
}
