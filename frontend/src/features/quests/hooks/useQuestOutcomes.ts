import { useCallback, useRef, useState } from 'react'
import { isSessionExpired } from '../../../shared/api/ApiError'
import { useAuth } from '../../auth/AuthContext'
import { questApi } from '../api/questApi'
import { refreshQuestOutcomeQueries } from '../questOutcomeQueryRefresh'
import {
  getQuestOutcomeErrorFeedback,
  type QuestOutcomeErrorFeedback,
} from '../questOutcomeErrorFeedback'
import type {
  QuestJourney,
  RedesignQuestRequest,
} from '../types'

interface UseQuestOutcomesOptions {
  onJourneyUpdated: (journey: QuestJourney) => void
}

export function useQuestOutcomes({
  onJourneyUpdated,
}: UseQuestOutcomesOptions) {
  const { expireSession } = useAuth()
  const pendingQuestIds = useRef(new Set<string>())
  const [pendingIds, setPendingIds] = useState<string[]>([])
  const [errors, setErrors] = useState<
    Record<string, QuestOutcomeErrorFeedback>
  >({})
  const [announcement, setAnnouncement] = useState<string | null>(null)

  const beginSubmission = useCallback((questId: string) => {
    if (pendingQuestIds.current.has(questId)) return false
    pendingQuestIds.current.add(questId)
    setPendingIds([...pendingQuestIds.current])
    setErrors((current) => {
      const next = { ...current }
      delete next[questId]
      return next
    })
    return true
  }, [])

  const endSubmission = useCallback((questId: string) => {
    pendingQuestIds.current.delete(questId)
    setPendingIds([...pendingQuestIds.current])
  }, [])

  const complete = useCallback(
    async (journey: QuestJourney): Promise<boolean> => {
      const quest = journey.currentQuest
      if (!beginSubmission(quest.id)) return false
      try {
        const updatedJourney = await questApi.complete(quest.id)
        onJourneyUpdated(updatedJourney)
        setAnnouncement(`‘${quest.title}’ 퀘스트를 완료했어요.`)
        await refreshQuestOutcomeQueries()
        return true
      } catch (error) {
        if (isSessionExpired(error)) {
          expireSession()
          return false
        }
        setErrors((current) => ({
          ...current,
          [quest.id]: getQuestOutcomeErrorFeedback(error, 'completion'),
        }))
        return false
      } finally {
        endSubmission(quest.id)
      }
    },
    [beginSubmission, endSubmission, expireSession, onJourneyUpdated],
  )

  const redesign = useCallback(
    async (
      journey: QuestJourney,
      input: RedesignQuestRequest,
    ): Promise<boolean> => {
      const quest = journey.currentQuest
      if (!beginSubmission(quest.id)) return false
      try {
        const response = await questApi.redesign(quest.id, input)
        onJourneyUpdated(response.journey)
        setAnnouncement(
          `‘${quest.title}’ 퀘스트를 더 작은 행동으로 바꿨어요.`,
        )
        await refreshQuestOutcomeQueries()
        return true
      } catch (error) {
        if (isSessionExpired(error)) {
          expireSession()
          return false
        }
        setErrors((current) => ({
          ...current,
          [quest.id]: getQuestOutcomeErrorFeedback(error, 'redesign'),
        }))
        return false
      } finally {
        endSubmission(quest.id)
      }
    },
    [beginSubmission, endSubmission, expireSession, onJourneyUpdated],
  )

  const clearError = useCallback((questId: string) => {
    setErrors((current) => {
      if (!current[questId]) return current
      const next = { ...current }
      delete next[questId]
      return next
    })
  }, [])

  return {
    announcement,
    complete,
    redesign,
    clearError,
    isPending: (questId: string) => pendingIds.includes(questId),
    getError: (questId: string) => errors[questId] ?? null,
  }
}
