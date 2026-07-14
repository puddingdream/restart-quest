import type {
  AppState,
  FailureReason,
  OnboardingProfile,
  Quest,
  QuestCategory,
  QuestDifficulty
} from "../../shared/types.js";

export const failureReasonLabels: Record<FailureReason, string> = {
  NOT_ENOUGH_TIME: "시간이 부족했다",
  TOO_OVERWHELMING: "너무 부담스러웠다",
  UNCLEAR_WHAT_TO_WRITE: "무엇을 써야 할지 몰랐다",
  MISSING_MATERIALS: "필요한 자료가 없었다",
  LOW_CONFIDENCE: "자신감이 낮았다",
  NOT_RELEVANT: "공고나 주제가 맞지 않았다",
  LOW_ENERGY: "오늘 에너지가 낮았다"
};

export const failureReasonHints: Record<FailureReason, string> = {
  NOT_ENOUGH_TIME: "예상 시간을 줄이고 한 단계만 남깁니다.",
  TOO_OVERWHELMING: "읽기나 고르기처럼 부담이 낮은 행동으로 바꿉니다.",
  UNCLEAR_WHAT_TO_WRITE: "예시 수집, 키워드 나열, 첫 문장 작성으로 쪼갭니다.",
  MISSING_MATERIALS: "자료 찾기나 링크 저장을 먼저 하도록 바꿉니다.",
  LOW_CONFIDENCE: "평가가 아니라 확인 행동으로 낮춥니다.",
  NOT_RELEVANT: "직무, 지역, 관심 조건을 다시 좁히는 행동으로 바꿉니다.",
  LOW_ENERGY: "5~10분 안에 끝나는 읽기 중심 행동으로 낮춥니다."
};

export function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function createInitialState(): AppState {
  return {
    sessionStarted: false,
    quests: [],
    failures: []
  };
}

export function startSession(state: AppState): AppState {
  return { ...state, sessionStarted: true };
}

export function saveProfile(state: AppState, profile: OnboardingProfile): AppState {
  return { ...state, profile };
}

export function generateTodayQuests(state: AppState, now = new Date()): AppState {
  if (!state.profile) return state;

  const questDate = todayKey(now);
  const activeToday = state.quests.filter(
    (quest) => quest.questDate === questDate && !quest.parentQuestId
  );

  if (activeToday.length > 0) return state;

  return {
    ...state,
    quests: [...state.quests, ...buildFallbackQuests(state.profile, questDate, now.toISOString())]
  };
}

export function completeQuest(state: AppState, questId: string, now = new Date()): AppState {
  return {
    ...state,
    quests: state.quests.map((quest) =>
      quest.id === questId
        ? { ...quest, status: "DONE", completedAt: now.toISOString() }
        : quest
    )
  };
}

export function failAndRedesignQuest(
  state: AppState,
  questId: string,
  reason: FailureReason,
  memo: string,
  now = new Date()
): AppState {
  const original = state.quests.find((quest) => quest.id === questId);
  if (!original) return state;

  const redesigned = buildRedesignedQuests(original, reason, now.toISOString());
  const failureId = `failure-${questId}-${now.getTime()}`;

  return {
    ...state,
    quests: [
      ...state.quests.map((quest) =>
        quest.id === questId ? { ...quest, status: "FAILED" as const } : quest
      ),
      ...redesigned
    ],
    failures: [
      ...state.failures,
      {
        id: failureId,
        questId,
        reason,
        memo: memo.trim(),
        createdAt: now.toISOString(),
        redesignedQuestIds: redesigned.map((quest) => quest.id)
      }
    ]
  };
}

function buildFallbackQuests(profile: OnboardingProfile, questDate: string, createdAt: string): Quest[] {
  const job = profile.desiredJob.trim() || "희망 직무";
  const interest = profile.interests[0] ?? "관심 분야";
  const minutes = profile.defaultEnergyLevel === "LOW" ? 10 : profile.defaultEnergyLevel === "MEDIUM" ? 15 : 20;
  const base = `quest-${questDate}`;

  return [
    createQuest({
      id: `${base}-job-search`,
      questDate,
      title: `${job} 공고 2개 저장하기`,
      description: `${profile.region} 지역 또는 원격 조건으로 맞는 공고를 2개만 골라 저장합니다.`,
      category: "JOB_SEARCH",
      difficulty: "EASY",
      estimatedMinutes: minutes,
      completionCriteria: "공고 2개를 저장하면 완료",
      sortOrder: 1,
      createdAt
    }),
    createQuest({
      id: `${base}-resume`,
      questDate,
      title: "이력서 프로젝트 설명 한 문단 확인하기",
      description: `${interest}와 연결되는 프로젝트 설명을 읽고 바꿀 표현 1개만 표시합니다.`,
      category: "RESUME",
      difficulty: profile.hasResume ? "EASY" : "TINY",
      estimatedMinutes: Math.max(5, minutes - 5),
      completionCriteria: "수정 후보 표현 1개를 표시하면 완료",
      sortOrder: 2,
      createdAt
    }),
    createQuest({
      id: `${base}-interview`,
      questDate,
      title: "공백 기간 답변 키워드 3개 적기",
      description: "완성된 답변을 쓰지 말고 쉬었던 기간을 설명할 키워드만 3개 적습니다.",
      category: "INTERVIEW",
      difficulty: "TINY",
      estimatedMinutes: 5,
      completionCriteria: "키워드 3개를 적으면 완료",
      sortOrder: 3,
      createdAt
    })
  ];
}

function buildRedesignedQuests(original: Quest, reason: FailureReason, createdAt: string): Quest[] {
  const idBase = `${original.id}-redesign-${Date.parse(createdAt)}`;
  const options: Record<FailureReason, Array<Pick<Quest, "title" | "description" | "completionCriteria">>> = {
    NOT_ENOUGH_TIME: [
      {
        title: "원래 퀘스트에서 첫 단계만 고르기",
        description: "오늘은 실행하지 않고 가장 먼저 할 행동 1개만 표시합니다.",
        completionCriteria: "첫 단계 1개를 고르면 완료"
      }
    ],
    TOO_OVERWHELMING: [
      {
        title: "관련 화면이나 문항만 3분 읽기",
        description: "무언가를 완성하지 않고 필요한 내용을 한 번 훑어봅니다.",
        completionCriteria: "읽은 항목 1개를 적으면 완료"
      }
    ],
    UNCLEAR_WHAT_TO_WRITE: [
      {
        title: "쓸 수 있는 키워드 3개만 적기",
        description: "문장으로 만들지 않고 떠오르는 단어만 나열합니다.",
        completionCriteria: "키워드 3개를 적으면 완료"
      },
      {
        title: "예시 문장 1개 찾아 저장하기",
        description: "내 문장을 만들기 전에 참고할 표현 1개만 저장합니다.",
        completionCriteria: "예시 1개를 저장하면 완료"
      }
    ],
    MISSING_MATERIALS: [
      {
        title: "필요한 자료 링크 1개 찾기",
        description: "지원서나 공고를 완성하지 않고 필요한 자료 위치만 확인합니다.",
        completionCriteria: "자료 링크 1개를 저장하면 완료"
      }
    ],
    LOW_CONFIDENCE: [
      {
        title: "이미 해본 행동 1개 확인하기",
        description: "평가하지 않고 최근에 해본 준비 행동을 하나만 적습니다.",
        completionCriteria: "해본 행동 1개를 적으면 완료"
      }
    ],
    NOT_RELEVANT: [
      {
        title: "희망 조건 1개만 다시 좁히기",
        description: "직무, 지역, 근무 형태 중 오늘 바꿔볼 조건 하나만 고릅니다.",
        completionCriteria: "조건 1개를 고르면 완료"
      }
    ],
    LOW_ENERGY: [
      {
        title: "5분짜리 확인 행동으로 줄이기",
        description: "문서 작성 대신 공고 제목이나 이력서 항목 하나만 읽습니다.",
        completionCriteria: "읽은 항목 1개를 표시하면 완료"
      }
    ]
  };

  return options[reason].map((item, index) =>
    createQuest({
      id: `${idBase}-${index + 1}`,
      questDate: original.questDate,
      parentQuestId: original.id,
      title: item.title,
      description: item.description,
      category: original.category,
      difficulty: reduceDifficulty(original.difficulty),
      estimatedMinutes: Math.min(10, Math.max(5, original.estimatedMinutes - 5)),
      completionCriteria: item.completionCriteria,
      sortOrder: original.sortOrder + index / 10,
      createdAt
    })
  );
}

function createQuest(input: Omit<Quest, "status" | "source">): Quest {
  return {
    ...input,
    status: "TODO",
    source: "FALLBACK_RULE"
  };
}

function reduceDifficulty(difficulty: QuestDifficulty): QuestDifficulty {
  if (difficulty === "NORMAL") return "EASY";
  return "TINY";
}
