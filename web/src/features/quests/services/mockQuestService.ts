import { OnboardingProfile } from "../../onboarding/types";
import {
  DailyQuest,
  DailyQuestResponse,
  FailureReason,
  QuestDifficulty,
  QuestDto,
  RedesignQuestResponse,
} from "../types";

const difficultyOrder: Record<QuestDifficulty, number> = {
  TINY: 1,
  EASY: 2,
  NORMAL: 3,
};

export function generateDailyQuests(profile: OnboardingProfile): DailyQuestResponse {
  const baseMinutes = profile.energyLevel === "LOW" ? 10 : profile.energyLevel === "MEDIUM" ? 15 : 25;
  const resumeQuest = profile.hasResume
    ? "이력서 프로젝트 설명 한 문단 점검하기"
    : "이력서에 넣을 프로젝트 후보 2개 적기";
  const interviewQuest = profile.hasInterviewExperience
    ? "최근 면접 질문 1개를 다시 답해보기"
    : "공백 기간 답변 키워드 3개 적기";

  const quests: QuestDto[] = [
    {
      title: `${profile.region} ${profile.desiredJob} 공고 2개 찾아보기`,
      description: `${profile.desiredWorkType} 조건과 관심 분야를 기준으로 오늘 확인할 공고 후보를 작게 고릅니다.`,
      category: "JOB_SEARCH",
      difficulty: profile.energyLevel === "HIGH" ? "EASY" : "TINY",
      estimatedMinutes: baseMinutes,
      completionCriteria: "공고 제목과 회사명을 2개 적으면 완료",
    },
    {
      title: resumeQuest,
      description: `${profile.interests}와 연결되는 경험을 하나만 골라 이력서 재료로 정리합니다.`,
      category: "RESUME",
      difficulty: profile.energyLevel === "LOW" ? "TINY" : "EASY",
      estimatedMinutes: Math.min(baseMinutes + 5, 25),
      completionCriteria: "수정할 문장 또는 후보 경험 1개를 남기면 완료",
    },
    {
      title: interviewQuest,
      description: "완성된 답변보다 다음에 이어 쓸 수 있는 문장 조각을 만드는 데 집중합니다.",
      category: profile.hasInterviewExperience ? "INTERVIEW" : "ROUTINE",
      difficulty: profile.energyLevel === "HIGH" ? "NORMAL" : "EASY",
      estimatedMinutes: Math.min(baseMinutes + 10, 30),
      completionCriteria: "키워드 3개 또는 짧은 답변 1개를 적으면 완료",
    },
  ];

  quests.forEach(assertQuestDto);
  return { profile, quests };
}

export function redesignQuest(
  originalQuest: DailyQuest,
  reason: FailureReason,
): RedesignQuestResponse {
  const smallerDifficulty = getSmallerDifficulty(originalQuest.difficulty);
  const smallerMinutes = Math.max(5, Math.min(originalQuest.estimatedMinutes - 5, 12));
  const quests = getRedesignTemplates(originalQuest, reason, smallerDifficulty, smallerMinutes);

  quests.forEach((quest) => {
    assertQuestDto(quest);
    if (difficultyOrder[quest.difficulty] > difficultyOrder[originalQuest.difficulty]) {
      throw new Error("Redesigned quest difficulty must not be higher than original.");
    }
    if (quest.estimatedMinutes >= originalQuest.estimatedMinutes && originalQuest.estimatedMinutes > 5) {
      throw new Error("Redesigned quest must take less time than original.");
    }
  });

  return {
    originalQuestId: originalQuest.id,
    reason,
    quests,
  };
}

function getRedesignTemplates(
  originalQuest: DailyQuest,
  reason: FailureReason,
  difficulty: QuestDifficulty,
  estimatedMinutes: number,
): QuestDto[] {
  if (reason === "NOT_SURE_WHAT_TO_WRITE") {
    return [
      {
        title: "쓸 키워드 3개만 적기",
        description: `${originalQuest.title}에 바로 쓰지 않고, 떠오르는 단어만 먼저 남깁니다.`,
        category: originalQuest.category,
        difficulty,
        estimatedMinutes,
        completionCriteria: "완성 문장이 아니라 키워드 3개를 적으면 완료",
      },
      {
        title: "첫 문장 후보 1개 만들기",
        description: "잘 쓴 문장보다 다음에 고칠 수 있는 초안을 하나 만듭니다.",
        category: originalQuest.category,
        difficulty: "TINY",
        estimatedMinutes: Math.min(estimatedMinutes, 8),
        completionCriteria: "한 문장을 적으면 완료",
      },
    ];
  }

  if (reason === "NO_MATERIAL") {
    return [
      {
        title: "필요한 자료 이름만 적기",
        description: "찾아야 할 링크, 파일, 경험 이름을 목록으로 분리합니다.",
        category: originalQuest.category,
        difficulty,
        estimatedMinutes,
        completionCriteria: "필요한 자료 2개를 적으면 완료",
      },
    ];
  }

  if (reason === "LOW_ENERGY" || reason === "NO_TIME") {
    return [
      {
        title: "5분 확인 행동으로 줄이기",
        description: `${originalQuest.title}을 끝내려 하지 않고, 시작 화면이나 문서만 열어 확인합니다.`,
        category: "ROUTINE",
        difficulty: "TINY",
        estimatedMinutes: 5,
        completionCriteria: "관련 화면이나 문서를 열고 다음 행동 1개를 적으면 완료",
      },
    ];
  }

  return [
    {
      title: "가장 작은 첫 단계만 고르기",
      description: `${originalQuest.title} 전체를 하지 않고, 오늘 이어갈 한 조각만 선택합니다.`,
      category: originalQuest.category,
      difficulty,
      estimatedMinutes,
      completionCriteria: "다음에 할 한 단계만 적으면 완료",
    },
  ];
}

function getSmallerDifficulty(difficulty: QuestDifficulty): QuestDifficulty {
  if (difficulty === "NORMAL") {
    return "EASY";
  }

  return "TINY";
}

function assertQuestDto(quest: QuestDto) {
  const requiredFields: Array<keyof QuestDto> = [
    "title",
    "description",
    "category",
    "difficulty",
    "estimatedMinutes",
    "completionCriteria",
  ];

  requiredFields.forEach((field) => {
    if (quest[field] === undefined || quest[field] === null || quest[field] === "") {
      throw new Error(`Quest DTO field is required: ${field}`);
    }
  });

  if (quest.estimatedMinutes < 5 || quest.estimatedMinutes > 30) {
    throw new Error("Quest estimated minutes must be between 5 and 30.");
  }
}
