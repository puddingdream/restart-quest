import { apiRequest } from '../../../shared/api/apiRequest'
import type {
  DailyQuestResponse,
  GenerateDailyQuestRequest,
  QuestJourney,
  RedesignQuestRequest,
  RedesignQuestResponse,
} from '../types'
import { questMockApi } from './questMockApi'
import { questOutcomeMockApi } from './questOutcomeMockApi'

export const questApi = {
  getToday() {
    return apiRequest<DailyQuestResponse>('/quests/today', {
      mock: ({ accessToken }) => questMockApi.getToday(accessToken),
    })
  },
  generate(input: GenerateDailyQuestRequest) {
    return apiRequest<DailyQuestResponse>('/quests/today/generate', {
      method: 'POST',
      body: input,
      mock: ({ accessToken }) => questMockApi.generate(input, accessToken),
    })
  },
  complete(questId: string) {
    return apiRequest<QuestJourney>(`/quests/${questId}/completion`, {
      method: 'POST',
      mock: ({ accessToken }) =>
        questOutcomeMockApi.complete(questId, accessToken),
    })
  },
  redesign(questId: string, input: RedesignQuestRequest) {
    return apiRequest<RedesignQuestResponse>(
      `/quests/${questId}/failure-redesign`,
      {
        method: 'POST',
        body: input,
        mock: ({ accessToken }) =>
          questOutcomeMockApi.redesign(questId, input, accessToken),
      },
    )
  },
}
