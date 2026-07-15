import type { OnboardingProfile } from "../../onboarding/types.js";
import type { DailyQuest, FailureReason, QuestDifficulty } from "../types.js";

let sequence = 0;

export function generateDailyQuests(profile: OnboardingProfile): DailyQuest[] {
  const role = profile.desiredRole || "희망 직무";
  const region = profile.region || "관심 지역";
  const minutes = minutesForEnergy(profile.energyLevel);

  return [
    {
      id: nextId("quest"),
      title: `${role} 공고 후보 2개 살펴보기`,
      description: `${region} 또는 ${profile.desiredWorkType} 조건으로 오늘 볼 공고 후보만 가볍게 확인합니다.`,
      category: "JOB_SEARCH",
      difficulty: "EASY",
      estimatedMinutes: minutes,
      completionCriteria: "괜찮아 보이는 공고 제목 2개를 메모하면 완료",
      status: "TODO",
      origin: "GENERATED",
    },
    {
      id: nextId("quest"),
      title: profile.hasResume ? "이력서 프로젝트 설명 한 문단 읽기" : "이력서 제목 한 줄 초안 만들기",
      description: profile.hasResume
        ? `${role} 지원에 맞춰 이미 있는 이력서에서 프로젝트 설명 한 문단만 읽고 표시합니다.`
        : `${role} 지원용 이력서에 넣을 제목 후보를 한 줄만 적습니다.`,
      category: "RESUME",
      difficulty: "NORMAL",
      estimatedMinutes: minutes + 8,
      completionCriteria: profile.hasResume ? "수정할 문장 1개를 표시하면 완료" : "제목 후보 1개를 적으면 완료",
      status: "TODO",
      origin: "GENERATED",
    },
    {
      id: nextId("quest"),
      title: profile.hasInterviewExperience ? "최근 면접 질문 1개 복기하기" : "공백 기간 답변 첫 문장 적기",
      description: profile.hasInterviewExperience
        ? "기억나는 질문 하나를 적고, 다음에는 어떤 키워드로 답할지 정합니다."
        : `${profile.careerGapMonths}개월 공백을 설명할 때 사용할 첫 문장만 짧게 적습니다.`,
      category: "INTERVIEW",
      difficulty: "EASY",
      estimatedMinutes: minutes,
      completionCriteria: "문장 또는 키워드 1개가 남으면 완료",
      status: "TODO",
      origin: "GENERATED",
    },
  ];
}

export function redesignQuest(
  source: DailyQuest,
  reason: FailureReason,
  note: string,
): DailyQuest[] {
  const loweredDifficulty = lowerDifficulty(source.difficulty);
  const firstMinutes = Math.max(5, Math.min(source.estimatedMinutes - 5, 8));
  const templates = redesignTemplates[reason];

  return templates.map((template, index) => ({
    id: nextId("redesign"),
    title: template.title(source),
    description: template.description(source),
    category: source.category,
    difficulty: loweredDifficulty,
    estimatedMinutes: Math.max(5, firstMinutes - index),
    completionCriteria: template.completionCriteria,
    status: "TODO",
    origin: "REDESIGNED",
    sourceQuestId: source.id,
    failureReason: reason,
    note: note.trim() || undefined,
  }));
}

function minutesForEnergy(energyLevel: OnboardingProfile["energyLevel"]): number {
  if (energyLevel === "HIGH") {
    return 20;
  }
  if (energyLevel === "MEDIUM") {
    return 15;
  }
  return 10;
}

function lowerDifficulty(difficulty: QuestDifficulty): QuestDifficulty {
  if (difficulty === "NORMAL") {
    return "EASY";
  }
  return "TINY";
}

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

type RedesignTemplate = {
  title: (source: DailyQuest) => string;
  description: (source: DailyQuest) => string;
  completionCriteria: string;
};

const redesignTemplates: Record<FailureReason, RedesignTemplate[]> = {
  NO_TIME: [
    {
      title: (source) => `${source.title} 전에 5분만 열어보기`,
      description: () => "전체를 끝내지 않고 화면이나 문서만 열어 다음 행동의 시작점을 만듭니다.",
      completionCriteria: "관련 화면이나 문서를 열어두면 완료",
    },
  ],
  TOO_BIG: [
    {
      title: () => "가장 작은 첫 칸 하나만 채우기",
      description: (source) => `${source.title} 전체 대신 첫 입력칸이나 첫 문장 하나만 다룹니다.`,
      completionCriteria: "첫 칸 또는 첫 문장 하나가 남으면 완료",
    },
  ],
  NOT_SURE_WHAT_TO_WRITE: [
    {
      title: () => "키워드 3개만 적기",
      description: () => "완성 문장 대신 떠오르는 단어 3개만 적어 다음 수정의 재료를 만듭니다.",
      completionCriteria: "키워드 3개를 적으면 완료",
    },
    {
      title: () => "첫 문장 후보 1개만 쓰기",
      description: () => "좋은 문장인지 판단하지 않고 후보 하나만 남깁니다.",
      completionCriteria: "첫 문장 후보 1개가 있으면 완료",
    },
  ],
  NO_MATERIAL: [
    {
      title: () => "필요한 자료 이름만 적기",
      description: () => "자료를 찾기 전에 어떤 자료가 필요한지 목록 한 줄을 만듭니다.",
      completionCriteria: "찾을 자료 이름 1개를 적으면 완료",
    },
  ],
  LOW_CONFIDENCE: [
    {
      title: () => "이미 해둔 것 1개 표시하기",
      description: () => "새로 만들기보다 가지고 있는 자료에서 쓸 수 있는 부분 하나만 찾습니다.",
      completionCriteria: "쓸 수 있는 문장이나 경험 1개를 표시하면 완료",
    },
  ],
  LOW_ENERGY: [
    {
      title: () => "읽기만 하는 5분 행동으로 바꾸기",
      description: () => "작성이나 선택 없이 관련 문장이나 공고를 읽는 행동으로 낮춥니다.",
      completionCriteria: "5분 동안 읽고 멈추면 완료",
    },
  ],
  NOT_INTERESTED: [
    {
      title: () => "맞지 않았던 조건 1개 적기",
      description: () => "관심 없는 이유를 한 가지 남겨 다음 공고 탐색 조건을 좁힙니다.",
      completionCriteria: "피하고 싶은 조건 1개를 적으면 완료",
    },
  ],
};
