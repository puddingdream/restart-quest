import { requireMockUser } from '../../auth/api/authMockApi'
import type {
  DashboardQuestSummary,
  TodayDashboardResponse,
} from '../types'

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

export const dashboardMockApi = {
  async getToday(accessToken: string | null): Promise<TodayDashboardResponse> {
    const user = requireMockUser(accessToken)
    if (user.email === 'ready@example.com') return createDemoDashboard()

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
