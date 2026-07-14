export type EnergyLevel = "LOW" | "MEDIUM" | "HIGH";
export type QuestCategory = "RESUME" | "JOB_SEARCH" | "INTERVIEW" | "LEARNING" | "POLICY" | "ROUTINE";
export type QuestDifficulty = "TINY" | "EASY" | "NORMAL";
export type QuestStatus = "TODO" | "DONE" | "FAILED" | "REDESIGNED" | "SKIPPED";
export type QuestSource = "AI" | "FALLBACK_RULE" | "MANUAL";

export type FailureReason =
  | "NOT_ENOUGH_TIME"
  | "TOO_OVERWHELMING"
  | "UNCLEAR_WHAT_TO_WRITE"
  | "MISSING_MATERIALS"
  | "LOW_CONFIDENCE"
  | "NOT_RELEVANT"
  | "LOW_ENERGY";

export interface OnboardingProfile {
  region: string;
  desiredJob: string;
  desiredWorkType: string;
  careerGapMonths: number;
  hasResume: boolean;
  interviewExperienceLevel: "NONE" | "LOW" | "MEDIUM";
  interests: string[];
  defaultEnergyLevel: EnergyLevel;
}

export interface Quest {
  id: string;
  questDate: string;
  parentQuestId?: string;
  title: string;
  description: string;
  category: QuestCategory;
  difficulty: QuestDifficulty;
  estimatedMinutes: number;
  completionCriteria: string;
  status: QuestStatus;
  source: QuestSource;
  sortOrder: number;
  createdAt: string;
  completedAt?: string;
}

export interface QuestFailure {
  id: string;
  questId: string;
  reason: FailureReason;
  memo: string;
  createdAt: string;
  redesignedQuestIds: string[];
}

export interface AppState {
  sessionStarted: boolean;
  profile?: OnboardingProfile;
  quests: Quest[];
  failures: QuestFailure[];
}

export interface DashboardSummary {
  totalQuests: number;
  doneQuests: number;
  failedQuests: number;
  redesignedQuests: number;
  nextQuest?: Quest;
  recentFailures: Array<{
    failure: QuestFailure;
    original?: Quest;
    redesigned: Quest[];
  }>;
}
