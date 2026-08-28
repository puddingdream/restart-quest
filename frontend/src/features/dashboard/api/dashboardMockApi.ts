import { requireMockUser } from '../../auth/api/authMockApi'
import { readStoredDailyQuest } from '../../quests/api/questMockStore'
import type {
  DashboardQuestSummary,
  TodayDashboardResponse,
} from '../types'
import type { Quest, QuestJourney } from '../../quests/types'

function getSeoulDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function createDemoDashboard(): TodayDashboardResponse {
  const date = getSeoulDate()
  const nextQuest: DashboardQuestSummary = {
    journeyId: `${date}-journey-2`,
    questId: `${date}-quest-2-revision-2`,
    title: '관심 공고의 자격 요건 한 줄 표시하기',
    category: 'JOB_SEARCH',
    estimatedMinutes: 10,
  }

  return {
    date,
    totalJourneys: 3,
    completedJourneys: 1,
    activeJourneys: 2,
    redesignCount: 1,
    progressPercent: 33,
    nextQuest,
    recentRedesigns: [
      {
        redesignId: `${date}-redesign-1`,
        journeyId: `${date}-journey-2`,
        originalQuestTitle: '관심 공고 한 개 살펴보기',
        replacementQuestTitle: nextQuest.title,
        reasonCode: 'TIME_SHORTAGE',
        createdAt: `${date}T10:05:00+09:00`,
      },
    ],
  }
}

function findQuestRevision(
  journey: QuestJourney | undefined,
  questId: string,
): Quest | undefined {
  if (!journey) return undefined
  if (journey.currentQuest.id === questId) return journey.currentQuest
  return journey.history.find(({ id }) => id === questId)
}

export const dashboardMockApi = {
  async getToday(accessToken: string | null): Promise<TodayDashboardResponse> {
    const user = requireMockUser(accessToken)
    if (user.email === 'ready@example.com') return createDemoDashboard()

    const stored = readStoredDailyQuest()
    if (stored?.userId === user.id && stored.plan.date === getSeoulDate()) {
      const completedJourneys = stored.plan.journeys.filter(
        ({ status }) => status === 'COMPLETED',
      ).length
      const activeJourneys = stored.plan.journeys.filter(
        ({ status }) => status === 'ACTIVE',
      )
      const nextJourney = activeJourneys[0]
      const redesigns = stored.redesigns ?? []

      return {
        date: stored.plan.date,
        totalJourneys: stored.plan.journeys.length,
        completedJourneys,
        activeJourneys: activeJourneys.length,
        redesignCount: redesigns.length,
        progressPercent:
          stored.plan.journeys.length === 0
            ? 0
            : Math.round(
                (completedJourneys / stored.plan.journeys.length) * 100,
              ),
        nextQuest: nextJourney
          ? {
              journeyId: nextJourney.journeyId,
              questId: nextJourney.currentQuest.id,
              title: nextJourney.currentQuest.title,
              category: nextJourney.currentQuest.category,
              estimatedMinutes: nextJourney.currentQuest.estimatedMinutes,
            }
          : null,
        recentRedesigns: redesigns
          .slice()
          .reverse()
          .slice(0, 5)
          .map((redesign) => {
            const journey = stored.plan.journeys.find(
              ({ journeyId }) => journeyId === redesign.journeyId,
            )
            const original = findQuestRevision(
              journey,
              redesign.originalQuestId,
            )
            const replacement = findQuestRevision(
              journey,
              redesign.replacementQuestId,
            )
            return {
              redesignId: redesign.id,
              journeyId: redesign.journeyId,
              originalQuestTitle: original?.title ?? '이전 퀘스트',
              replacementQuestTitle: replacement?.title ?? '더 쉬운 퀘스트',
              reasonCode: redesign.reasonCode,
              createdAt: redesign.createdAt,
            }
          }),
      }
    }

    return {
      date: getSeoulDate(),
      totalJourneys: 0,
      completedJourneys: 0,
      activeJourneys: 0,
      redesignCount: 0,
      progressPercent: 0,
      nextQuest: null,
      recentRedesigns: [],
    }
  },
}
