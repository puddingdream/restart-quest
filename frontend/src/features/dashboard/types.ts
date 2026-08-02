export type DashboardQuestCategory =
  | 'RESUME'
  | 'JOB_SEARCH'
  | 'INTERVIEW'
  | 'LEARNING'
  | 'POLICY'
  | 'ROUTINE'

export type DashboardRedesignReason =
  | 'TIME_SHORTAGE'
  | 'TASK_TOO_LARGE'
  | 'START_POINT_UNCLEAR'
  | 'MATERIALS_MISSING'
  | 'LOW_ENERGY'
  | 'TASK_NOT_RELEVANT'
  | 'OTHER'

export interface DashboardQuestSummary {
  journeyId: string
  questId: string
  title: string
  category: DashboardQuestCategory
  estimatedMinutes: number
}

export interface CompletedJourneySummary extends DashboardQuestSummary {
  completedAt: string
}

export interface DashboardRedesignSummary {
  redesignId: string
  journeyId: string
  originalQuestTitle: string
  replacementQuestTitle: string
  reasonCode: DashboardRedesignReason
  createdAt: string
}

export interface TodayDashboardResponse {
  date: string
  totalJourneys: number
  completedJourneys: CompletedJourneySummary[]
  activeJourneys: DashboardQuestSummary[]
  redesignCount: number
  progressPercent: number
  nextQuest: DashboardQuestSummary | null
  recentRedesigns: DashboardRedesignSummary[]
}

export type TodayDashboardState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: TodayDashboardResponse; error: null }
  | { status: 'error'; data: null; error: string }

export const DASHBOARD_CATEGORY_LABELS: Record<
  DashboardQuestCategory,
  string
> = {
  RESUME: '이력서',
  JOB_SEARCH: '공고 탐색',
  INTERVIEW: '면접 준비',
  LEARNING: '직무 학습',
  POLICY: '지원 정보',
  ROUTINE: '준비 루틴',
}

export const REDESIGN_REASON_LABELS: Record<DashboardRedesignReason, string> = {
  TIME_SHORTAGE: '시간이 부족했어요',
  TASK_TOO_LARGE: '범위가 커 보였어요',
  START_POINT_UNCLEAR: '시작점을 찾기 어려웠어요',
  MATERIALS_MISSING: '준비물이 더 필요했어요',
  LOW_ENERGY: '오늘 가능한 에너지에 맞췄어요',
  TASK_NOT_RELEVANT: '현재 목표와 맞지 않았어요',
  OTHER: '다른 이유가 있었어요',
}
