import { apiClient, type ApiClient } from '../../lib/api/ApiClient'
import {
  parseTodayView,
  type BlockQuestInput,
  type CheckInInput,
  type TodayView,
} from './contracts'

export interface QuestApi {
  block(questId: string, input: BlockQuestInput): Promise<TodayView>
  checkIn(input: CheckInInput): Promise<TodayView>
  complete(questId: string, version: number): Promise<TodayView>
  today(): Promise<TodayView>
}

export class HttpQuestApi implements QuestApi {
  constructor(private readonly client: ApiClient) {}

  block(questId: string, input: BlockQuestInput): Promise<TodayView> {
    return this.client.write(`/api/v1/quests/${encodeURIComponent(questId)}/block`, {
      body: input,
      parse: parseTodayView,
    })
  }

  checkIn(input: CheckInInput): Promise<TodayView> {
    return this.client.write('/api/v1/check-ins', {
      body: input,
      parse: parseTodayView,
    })
  }

  complete(questId: string, version: number): Promise<TodayView> {
    return this.client.write(`/api/v1/quests/${encodeURIComponent(questId)}/complete`, {
      body: { version },
      parse: parseTodayView,
    })
  }

  today(): Promise<TodayView> {
    return this.client.get('/api/v1/today', parseTodayView)
  }
}

export const questApi = new HttpQuestApi(apiClient)
