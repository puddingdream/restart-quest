import { apiRequest } from '../../../shared/api/apiRequest'
import type { TodayDashboardResponse } from '../types'

export const dashboardApi = {
  getToday(): Promise<TodayDashboardResponse> {
    return apiRequest<TodayDashboardResponse>('/dashboard/today')
  },
}
