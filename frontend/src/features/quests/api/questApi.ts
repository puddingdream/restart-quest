import { apiRequest } from '../../../shared/api/apiRequest'
import type {
  GenerateDailyQuestRequest,
  RedesignQuestRequest,
} from '../types'
import {
  toDailyQuestResponse,
  toQuestJourney,
  toRedesignQuestResponse,
  type DailyQuestWireResponse,
  type FailureRedesignApiResponse,
  type QuestJourneyApiResponse,
} from './questWire'

export const questApi = {
  getToday() {
    return apiRequest<DailyQuestWireResponse>('/quests/today').then(
      toDailyQuestResponse,
    )
  },
  generate(input: GenerateDailyQuestRequest) {
    return apiRequest<DailyQuestWireResponse>('/quests/today/generate', {
      method: 'POST',
      body: input,
    }).then(toDailyQuestResponse)
  },
  complete(questId: string) {
    return apiRequest<QuestJourneyApiResponse>(
      `/quests/${questId}/completion`,
      { method: 'POST' },
    ).then(toQuestJourney)
  },
  redesign(questId: string, input: RedesignQuestRequest) {
    return apiRequest<FailureRedesignApiResponse>(
      `/quests/${questId}/failure-redesign`,
      { method: 'POST', body: input },
    ).then(toRedesignQuestResponse)
  },
}
