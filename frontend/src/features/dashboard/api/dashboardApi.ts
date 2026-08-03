import { apiRequest } from '../../../shared/api/apiRequest'
import type { TodayDashboardResponse } from '../types'
import { dashboardMockApi } from './dashboardMockApi'

export const dashboardApi = {
  getToday(): Promise<TodayDashboardResponse> {
    return apiRequest<TodayDashboardResponse>('/dashboard/today', {
      mock: ({ accessToken }) => dashboardMockApi.getToday(accessToken),
    })
  },
}
