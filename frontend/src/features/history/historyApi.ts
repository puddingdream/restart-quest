import { apiClient, type ApiClient } from '../../lib/api/ApiClient'
import { parseHistoryView, type HistoryView } from './contracts'

export interface HistoryApi {
  history(from: string, to: string): Promise<HistoryView>
}

export class HttpHistoryApi implements HistoryApi {
  constructor(private readonly client: ApiClient) {}

  history(from: string, to: string): Promise<HistoryView> {
    const search = new URLSearchParams({ from, to })
    return this.client.get(`/api/v1/history?${search}`, parseHistoryView)
  }
}

export const historyApi = new HttpHistoryApi(apiClient)
