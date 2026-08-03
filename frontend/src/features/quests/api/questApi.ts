import { apiRequest } from '../../../shared/api/apiRequest'
import type {
  GenerateDailyQuestRequest,
  RedesignQuestRequest,
} from '../types'
import { questMockApi } from './questMockApi'
import { questOutcomeMockApi } from './questOutcomeMockApi'
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
    return apiRequest<DailyQuestWireResponse>('/quests/today', {
      mock: ({ accessToken }) => questMockApi.getToday(accessToken),
    }).then(toDailyQuestResponse)
  },
  generate(input: GenerateDailyQuestRequest) {
    return apiRequest<DailyQuestWireResponse>('/quests/today/generate', {
      method: 'POST',
      body: input,
      mock: ({ accessToken }) => questMockApi.generate(input, accessToken),
    }).then(toDailyQuestResponse)
  },
  complete(questId: string) {
    return apiRequest<QuestJourneyApiResponse>(
      `/quests/${questId}/completion`,
      {
        method: 'POST',
        mock: ({ accessToken }) =>
          questOutcomeMockApi.complete(questId, accessToken),
      },
    ).then(toQuestJourney)
  },
  redesign(questId: string, input: RedesignQuestRequest) {
    return apiRequest<FailureRedesignApiResponse>(
      `/quests/${questId}/failure-redesign`,
      {
        method: 'POST',
        body: input,
        mock: ({ accessToken }) =>
          questOutcomeMockApi.redesign(questId, input, accessToken),
      },
    ).then(toRedesignQuestResponse)
  },
}
