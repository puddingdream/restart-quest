import { apiRequest } from '../../../shared/api/apiRequest'
import { getAccessToken } from '../../../shared/auth/sessionToken'
import type { TodayDashboardResponse } from '../types'
import { dashboardMockApi } from './dashboardMockApi'

function usesFeatureMock(): boolean {
  const apiMode =
    import.meta.env?.VITE_API_MODE ??
    document
      .querySelector<HTMLMetaElement>('meta[name="restart-quest-api-mode"]')
      ?.getAttribute('content')

  return apiMode !== 'http'
}

export const dashboardApi = {
  getToday(): Promise<TodayDashboardResponse> {
    if (usesFeatureMock()) {
      return dashboardMockApi.getToday(getAccessToken())
    }
    return apiRequest<TodayDashboardResponse>('/dashboard/today')
  },
}
