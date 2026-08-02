import { apiRequest } from '../../../shared/api/apiRequest'
import type {
  DailyQuestResponse,
  GenerateDailyQuestRequest,
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
}
