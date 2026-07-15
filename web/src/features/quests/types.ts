import { OnboardingProfile } from "../onboarding/types";

export type QuestCategory =
  | "JOB_SEARCH"
  | "RESUME"
  | "INTERVIEW"
  | "LEARNING"
  | "POLICY"
  | "ROUTINE";

export type QuestDifficulty = "TINY" | "EASY" | "NORMAL";

export type QuestStatus = "TODO" | "DONE" | "FAILED" | "REDESIGNED";

export type FailureReason =
  | "NO_TIME"
  | "TOO_BIG"
  | "NOT_SURE_WHAT_TO_WRITE"
  | "NO_MATERIAL"
  | "LOW_CONFIDENCE"
  | "LOW_ENERGY"
  | "NOT_INTERESTED";

export type QuestDto = {
  title: string;
  description: string;
  category: QuestCategory;
  difficulty: QuestDifficulty;
  estimatedMinutes: number;
  completionCriteria: string;
};

export type DailyQuest = QuestDto & {
  id: string;
  status: QuestStatus;
  sourceQuestId?: string;
  failureReason?: FailureReason;
  failureNote?: string;
};

export type DailyQuestResponse = {
  profile: OnboardingProfile;
  quests: QuestDto[];
};

export type RedesignQuestResponse = {
  originalQuestId: string;
  reason: FailureReason;
  quests: QuestDto[];
};

export type FailureSubmission = {
  reason: FailureReason;
  note: string;
};

export type RedesignHistoryItem = {
  originalQuestId: string;
  originalTitle: string;
  reason: FailureReason;
  redesignedTitles: string[];
  createdAt: string;
};
