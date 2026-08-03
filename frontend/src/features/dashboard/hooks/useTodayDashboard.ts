import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getApiErrorMessage,
  isSessionExpired,
} from '../../../shared/api/ApiError'
import { useAuth } from '../../auth/AuthContext'
import {
  QUEST_OUTCOME_QUERY_KEYS,
  registerQuestOutcomeQueryRefresher,
} from '../../quests/questOutcomeQueryRefresh'
import { dashboardApi } from '../api/dashboardApi'
import type { TodayDashboardState } from '../types'

const INITIAL_STATE: TodayDashboardState = {
  status: 'loading',
  data: null,
  error: null,
}

export function useTodayDashboard() {
  const { expireSession } = useAuth()
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
      if (isSessionExpired(error)) {
        expireSession()
        return
      }
      if (requestId === requestIdRef.current) {
        setState({
          status: 'error',
          data: null,
          error: getApiErrorMessage(error),
        })
      }
    }
  }, [expireSession])

  useEffect(() => {
    void load()
    return () => {
      requestIdRef.current += 1
    }
  }, [load])

  useEffect(
    () =>
      registerQuestOutcomeQueryRefresher(
        QUEST_OUTCOME_QUERY_KEYS.dashboard,
        load,
      ),
    [load],
  )

  return { state, retry: load }
}
