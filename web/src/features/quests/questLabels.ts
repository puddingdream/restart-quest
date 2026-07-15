import { FailureReason, QuestCategory, QuestDifficulty, QuestStatus } from "./types";

export const categoryLabel: Record<QuestCategory, string> = {
  JOB_SEARCH: "공고 탐색",
  RESUME: "이력서",
  INTERVIEW: "면접 준비",
  LEARNING: "학습",
  POLICY: "정책 확인",
  ROUTINE: "루틴",
};

export const difficultyLabel: Record<QuestDifficulty, string> = {
  TINY: "아주 작게",
  EASY: "가볍게",
  NORMAL: "보통",
};

export const statusLabel: Record<QuestStatus, string> = {
  TODO: "대기 중",
  DONE: "완료",
  FAILED: "막힘 기록",
  REDESIGNED: "더 작게 나눔",
};

export const failureReasonLabel: Record<FailureReason, string> = {
  NO_TIME: "시간이 부족했다",
  TOO_BIG: "오늘 하기에는 컸다",
  NOT_SURE_WHAT_TO_WRITE: "무엇을 써야 할지 몰랐다",
  NO_MATERIAL: "자료가 부족했다",
  LOW_CONFIDENCE: "시작 문장이 떠오르지 않았다",
  LOW_ENERGY: "오늘 에너지가 낮았다",
  NOT_INTERESTED: "지금 관심과 맞지 않았다",
};

export const failureReasonHelp: Record<FailureReason, string> = {
  NO_TIME: "예상 시간을 줄인 첫 행동으로 바꿉니다.",
  TOO_BIG: "완성보다 확인과 선택 중심으로 줄입니다.",
  NOT_SURE_WHAT_TO_WRITE: "빈 문서 대신 키워드와 첫 문장부터 시작합니다.",
  NO_MATERIAL: "자료를 찾는 행동부터 다시 잡습니다.",
  LOW_CONFIDENCE: "정답을 만들기보다 후보를 적는 행동으로 낮춥니다.",
  LOW_ENERGY: "5분 안에 끝나는 확인 행동으로 줄입니다.",
  NOT_INTERESTED: "관심 직무와 더 가까운 재료로 바꿉니다.",
};
