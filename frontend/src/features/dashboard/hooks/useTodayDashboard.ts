import { useCallback, useEffect, useRef, useState } from 'react'
import { getApiErrorMessage } from '../../../shared/api/ApiError'
import { dashboardApi } from '../api/dashboardApi'
import type { TodayDashboardState } from '../types'

const INITIAL_STATE: TodayDashboardState = {
  status: 'loading',
  data: null,
  error: null,
}

export function useTodayDashboard() {
  const [state, setState] = useState<TodayDashboardState>(INITIAL_STATE)
  const requestIdRef = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setState(INITIAL_STATE)

    try {
      const data = await dashboardApi.getToday()
      if (requestId === requestIdRef.current) {
        setState({ status: 'success', data, error: null })
      }
    } catch (error) {
      if (requestId === requestIdRef.current) {
        setState({
          status: 'error',
          data: null,
          error: getApiErrorMessage(error),
        })
      }
    }
  }, [])

  useEffect(() => {
    void load()
    return () => {
      requestIdRef.current += 1
    }
  }, [load])

  return { state, retry: load }
}
