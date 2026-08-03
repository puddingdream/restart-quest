import { useCallback, useEffect, useRef, useState } from 'react'
import { isSessionExpired } from '../../../shared/api/ApiError'
import { useAuth } from '../../auth/AuthContext'
import {
  QUEST_OUTCOME_QUERY_KEYS,
  registerQuestOutcomeQueryRefresher,
} from '../questOutcomeQueryRefresh'
import { questApi } from '../api/questApi'
import {
  getQuestErrorFeedback,
  type QuestErrorFeedback,
} from '../questErrorFeedback'
import type {
  DailyQuestResponse,
  EnergyLevel,
  QuestJourney,
} from '../types'

export function useTodayQuests() {
  const { expireSession } = useAuth()
  const [plan, setPlan] = useState<DailyQuestResponse | null>(null)
  const [selectedEnergy, setSelectedEnergy] = useState<EnergyLevel | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [error, setError] = useState<QuestErrorFeedback | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const submissionPending = useRef(false)

  const loadToday = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await questApi.getToday()
      setPlan(response.journeys.length > 0 ? response : null)
      setSelectedEnergy(response.energyLevel)
    } catch (loadError) {
      if (isSessionExpired(loadError)) {
        expireSession()
        return
      }
      setError(getQuestErrorFeedback(loadError, 'load'))
    } finally {
      setIsLoading(false)
    }
  }, [expireSession])

  useEffect(() => {
    void loadToday()
  }, [loadToday])

  const refreshToday = useCallback(async () => {
    try {
      const response = await questApi.getToday()
      setPlan(response.journeys.length > 0 ? response : null)
      setSelectedEnergy(response.energyLevel)
    } catch (refreshError) {
      if (isSessionExpired(refreshError)) {
        expireSession()
        return
      }
      throw refreshError
    }
  }, [expireSession])

  useEffect(
    () =>
      registerQuestOutcomeQueryRefresher(
        QUEST_OUTCOME_QUERY_KEYS.today,
        refreshToday,
      ),
    [refreshToday],
  )

  const generate = useCallback(async () => {
    if (submissionPending.current) return
    if (!selectedEnergy) {
      setValidationError('오늘 가능한 에너지를 하나 선택해 주세요.')
      return
    }

    submissionPending.current = true
    setIsGenerating(true)
    setValidationError(null)
    setError(null)
    try {
      setPlan(await questApi.generate({ energyLevel: selectedEnergy }))
    } catch (generateError) {
      if (isSessionExpired(generateError)) {
        expireSession()
        return
      }
      setError(getQuestErrorFeedback(generateError, 'generate'))
    } finally {
      submissionPending.current = false
      setIsGenerating(false)
    }
  }, [expireSession, selectedEnergy])

  function selectEnergy(energyLevel: EnergyLevel) {
    setSelectedEnergy(energyLevel)
    setValidationError(null)
    setError(null)
  }

  function retry() {
    if (error?.source === 'generate') void generate()
    else void loadToday()
  }

  const replaceJourney = useCallback((updatedJourney: QuestJourney) => {
    setPlan((currentPlan) => {
      if (!currentPlan) return currentPlan
      return {
        ...currentPlan,
        journeys: currentPlan.journeys.map((journey) =>
          journey.journeyId === updatedJourney.journeyId
            ? updatedJourney
            : journey,
        ),
      }
    })
  }, [])

  return {
    plan,
    selectedEnergy,
    validationError,
    error,
    isLoading,
    isGenerating,
    selectEnergy,
    generate,
    retry,
    refresh: loadToday,
    replaceJourney,
  }
}
