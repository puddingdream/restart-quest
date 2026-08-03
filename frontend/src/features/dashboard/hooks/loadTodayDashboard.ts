import { ApiError, getApiErrorMessage } from '../../../shared/api/ApiError'
import type { TodayDashboardResponse, TodayDashboardState } from '../types'

type TodayDashboardLoadResult =
  | TodayDashboardState
  | { status: 'session-expired' }

export async function loadTodayDashboard(
  request: () => Promise<TodayDashboardResponse>,
): Promise<TodayDashboardLoadResult> {
  try {
    const data = await request()
    return { status: 'success', data, error: null }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return { status: 'session-expired' }
    }

    return {
      status: 'error',
      data: null,
      error: getApiErrorMessage(error),
    }
  }
}
