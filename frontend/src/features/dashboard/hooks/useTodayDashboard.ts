import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { dashboardApi } from '../api/dashboardApi'
import type { TodayDashboardState } from '../types'
import { loadTodayDashboard } from './loadTodayDashboard'

const INITIAL_STATE: TodayDashboardState = {
  status: 'loading',
  data: null,
  error: null,
}

export function useTodayDashboard() {
  const { logout } = useAuth()
  const [state, setState] = useState<TodayDashboardState>(INITIAL_STATE)
  const requestIdRef = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setState(INITIAL_STATE)

    const nextState = await loadTodayDashboard(dashboardApi.getToday)
    if (requestId !== requestIdRef.current) return

    if (nextState.status === 'session-expired') {
      logout()
      return
    }

    setState(nextState)
  }, [logout])

  useEffect(() => {
    void load()
    return () => {
      requestIdRef.current += 1
    }
  }, [load])

  return { state, retry: load }
}
