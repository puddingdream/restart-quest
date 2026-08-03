import { apiRequest } from '../../../shared/api/apiRequest'
import { getAccessToken } from '../../../shared/auth/sessionToken'
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
    return apiRequest<DailyQuestWireResponse>('/quests/today').then(
      toDailyQuestResponse,
    )
  },
  generate(input: GenerateDailyQuestRequest) {
    if (usesFeatureMock()) {
      return questMockApi.generate(input, getAccessToken())
    }
    return apiRequest<DailyQuestWireResponse>('/quests/today/generate', {
      method: 'POST',
      body: input,
    }).then(toDailyQuestResponse)
  },
  complete(questId: string) {
    if (usesFeatureMock()) {
      return questOutcomeMockApi.complete(questId, getAccessToken())
    }
    return apiRequest<QuestJourneyApiResponse>(
      `/quests/${questId}/completion`,
      { method: 'POST' },
    ).then(toQuestJourney)
  },
  redesign(questId: string, input: RedesignQuestRequest) {
    if (usesFeatureMock()) {
      return questOutcomeMockApi.redesign(questId, input, getAccessToken())
    }
    return apiRequest<FailureRedesignApiResponse>(
      `/quests/${questId}/failure-redesign`,
      { method: 'POST', body: input },
    ).then(toRedesignQuestResponse)
  },
}
