import { apiRequest } from '../../../shared/api/apiRequest'
import type {
  DailyQuestResponse,
  GenerateDailyQuestRequest,
  QuestJourney,
  RedesignQuestRequest,
  RedesignQuestResponse,
} from '../types'

export const questApi = {
  getToday() {
    return apiRequest<DailyQuestResponse>('/quests/today')
  },
  generate(input: GenerateDailyQuestRequest) {
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
