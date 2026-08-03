import type { TodayDashboardState } from '../types'
import { DashboardOverview } from './DashboardOverview'
import {
  DashboardEmpty,
  DashboardError,
  DashboardLoading,
} from './DashboardStates'

interface DashboardContentProps {
  state: TodayDashboardState
  onRetry: () => void
}

export function DashboardContent({ state, onRetry }: DashboardContentProps) {
  if (state.status === 'loading') return <DashboardLoading />
  if (state.status === 'error') {
    return <DashboardError message={state.error} onRetry={onRetry} />
  }
  if (state.data.totalJourneys === 0) {
    return <DashboardEmpty date={state.data.date} />
  }
  return <DashboardOverview data={state.data} />
}
