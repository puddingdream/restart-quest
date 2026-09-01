import { useEffect, useState, useSyncExternalStore } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { QuestApiClient } from './api/client'
import { AppShell } from './components/AppShell'
import { Button } from './components/Button'
import { Feedback } from './components/Feedback'
import { LandingPage } from './features/journey/LandingPage'
import { QuestPage } from './features/journey/QuestPage'
import { StartPage } from './features/journey/StartPage'
import './features/journey/journey.css'
import { JourneyStore } from './state/journeyStore'

let browserStore: JourneyStore | undefined

function getBrowserStore() {
  browserStore ??= new JourneyStore(new QuestApiClient())
  return browserStore
}

function RouteStatus({
  message,
  onRetry,
  title,
}: {
  message: string
  onRetry?: () => void
  title: string
}) {
  return (
    <AppShell>
      <section className="route-status" aria-labelledby="route-status-title">
        <Feedback tone={onRetry ? 'error' : 'info'} title={title}>
          <p id="route-status-title">{message}</p>
          {onRetry && <Button onClick={onRetry}>다시 시도</Button>}
        </Feedback>
      </section>
    </AppShell>
  )
}

function JourneyRoutes({
  sessionNotice,
  store,
}: {
  sessionNotice: string | null
  store: JourneyStore
}) {
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState)
  const hasJourney = state.snapshot !== null
  const bootstrapStatus = state.bootstrap.status

  if (bootstrapStatus === 'idle' || bootstrapStatus === 'loading') {
    return <RouteStatus title="여정 확인 중" message="저장된 작은 행동을 불러오고 있어요." />
  }

  if (bootstrapStatus === 'network-error' || bootstrapStatus === 'error') {
    return (
      <RouteStatus
        title="여정을 불러오지 못했어요"
        message={state.bootstrap.message}
        onRetry={() => void store.bootstrap()}
      />
    )
  }

  const startNotice = sessionNotice
    ?? (bootstrapStatus === 'session-expired' ? state.bootstrap.message : null)
  const mustStartAgain = startNotice !== null

  return (
    <Routes>
      <Route
        path="/"
        element={
          hasJourney ? <Navigate replace to="/quest" />
            : mustStartAgain ? <Navigate replace to="/start" />
              : <LandingPage />
        }
      />
      <Route
        path="/start"
        element={
          hasJourney ? <Navigate replace to="/quest" />
            : <StartPage notice={startNotice} store={store} />
        }
      />
      <Route
        path="/quest"
        element={
          hasJourney
            ? <QuestPage store={store} />
            : <Navigate replace to="/start" />
        }
      />
      <Route path="*" element={<Navigate replace to={hasJourney ? '/quest' : '/'} />} />
    </Routes>
  )
}

export function AppRoutes({ store: providedStore }: { store?: JourneyStore } = {}) {
  const [store] = useState(() => providedStore ?? getBrowserStore())
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState)
  const [sessionNotice, setSessionNotice] = useState<string | null>(null)

  useEffect(() => {
    if (state.bootstrap.status === 'idle') {
      void store.bootstrap()
    }
  }, [state.bootstrap.status, store])

  useEffect(() => {
    if (state.mutation.status === 'session-expired') {
      setSessionNotice(state.mutation.message)
      void store.bootstrap()
    }
  }, [state.mutation, store])

  return <JourneyRoutes sessionNotice={sessionNotice} store={store} />
}
