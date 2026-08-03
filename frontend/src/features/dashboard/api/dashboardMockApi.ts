import type { AuthUser } from '../../auth/types'
import { mockRequest } from '../../../shared/api/mockApi'
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
    completedJourneys: [
      {
        journeyId: `${date}-journey-1`,
        questId: `${date}-quest-1`,
        title: '이력서 경험 문장 하나 다듬기',
        category: 'RESUME',
        estimatedMinutes: 15,
        completedAt: `${date}T09:20:00+09:00`,
      },
    ],
    activeJourneys: [
      nextQuest,
      {
        journeyId: `${date}-journey-3`,
        questId: `${date}-quest-3`,
        title: '면접 답변의 첫 문장 준비하기',
        category: 'INTERVIEW',
        estimatedMinutes: 20,
      },
    ],
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
    const user = await mockRequest<AuthUser>('/users/me', {
      method: 'GET',
      accessToken,
    })
    if (user.email === 'ready@example.com') return createDemoDashboard()

    return {
      date: getSeoulDate(),
      totalJourneys: 0,
      completedJourneys: [],
      activeJourneys: [],
      redesignCount: 0,
      progressPercent: 0,
      nextQuest: null,
      recentRedesigns: [],
    }
  },
}
