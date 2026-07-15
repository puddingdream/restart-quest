export type QuestCategory =
  | "JOB_SEARCH"
  | "RESUME"
  | "INTERVIEW"
  | "LEARNING"
  | "POLICY"
  | "ROUTINE";

export type QuestDifficulty = "TINY" | "EASY" | "NORMAL";
export type QuestStatus = "TODO" | "DONE" | "FAILED" | "REDESIGNED";
export type QuestOrigin = "GENERATED" | "REDESIGNED";

export type FailureReason =
  | "NO_TIME"
  | "TOO_BIG"
  | "NOT_SURE_WHAT_TO_WRITE"
  | "NO_MATERIAL"
  | "LOW_CONFIDENCE"
  | "LOW_ENERGY"
  | "NOT_INTERESTED";

export interface DailyQuest {
  id: string;
  title: string;
  description: string;
  category: QuestCategory;
  difficulty: QuestDifficulty;
  estimatedMinutes: number;
  completionCriteria: string;
  status: QuestStatus;
  origin: QuestOrigin;
  sourceQuestId?: string;
  failureReason?: FailureReason;
  note?: string;
}

export interface RedesignRecord {
  id: string;
  sourceQuestId: string;
  sourceTitle: string;
  reason: FailureReason;
  note?: string;
  redesignedQuestIds: string[];
  createdAtLabel: string;
}

export const categoryLabels: Record<QuestCategory, string> = {
  JOB_SEARCH: "공고 탐색",
  RESUME: "이력서",
  INTERVIEW: "면접 준비",
  LEARNING: "학습",
  POLICY: "정책 확인",
  ROUTINE: "루틴",
};

export const difficultyLabels: Record<QuestDifficulty, string> = {
  TINY: "아주 작게",
  EASY: "가볍게",
  NORMAL: "보통",
};

export const statusLabels: Record<QuestStatus, string> = {
  TODO: "진행 전",
  DONE: "완료",
  FAILED: "다시 나누는 중",
  REDESIGNED: "더 작게 나눔",
};

export const failureReasonLabels: Record<FailureReason, string> = {
  NO_TIME: "시간이 부족했다",
  TOO_BIG: "너무 부담스러웠다",
  NOT_SURE_WHAT_TO_WRITE: "무엇을 써야 할지 몰랐다",
  NO_MATERIAL: "자료가 없었다",
  LOW_CONFIDENCE: "자신감이 낮았다",
  LOW_ENERGY: "오늘 에너지가 낮았다",
  NOT_INTERESTED: "공고나 주제가 맞지 않았다",
};
