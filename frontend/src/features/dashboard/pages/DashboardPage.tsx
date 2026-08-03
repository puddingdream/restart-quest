import { AppShell } from '../../../app/components/AppShell'
import { DashboardContent } from '../components/DashboardContent'
import { useTodayDashboard } from '../hooks/useTodayDashboard'
import '../dashboard.css'

export function DashboardPage() {
  const { state, retry } = useTodayDashboard()

  return (
    <AppShell>
      <main className="page-container dashboard-page" aria-labelledby="dashboard-title">
        <DashboardContent state={state} onRetry={() => void retry()} />
      </main>
    </AppShell>
  )
}
