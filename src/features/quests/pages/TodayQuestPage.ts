import { button, h } from "../../../shared/dom.js";
import type { OnboardingProfile } from "../../onboarding/types.js";
import type { DailyQuest, FailureReason } from "../types.js";
import { renderFailureReasonForm } from "../components/FailureReasonForm.js";
import { renderQuestCard } from "../components/QuestCard.js";

type TodayQuestPageProps = {
  profile: OnboardingProfile;
  quests: DailyQuest[];
  activeFailureQuestId: string | null;
  onGenerate: () => void;
  onComplete: (questId: string) => void;
  onStartFailure: (questId: string) => void;
  onCancelFailure: () => void;
  onSubmitFailure: (questId: string, reason: FailureReason, note: string) => void;
  onOpenDashboard: () => void;
};

export function renderTodayQuestPage(props: TodayQuestPageProps): HTMLElement {
  const generatedQuests = props.quests.filter((quest) => quest.origin === "GENERATED");
  const redesignedQuests = props.quests.filter((quest) => quest.origin === "REDESIGNED");

  if (generatedQuests.length === 0) {
    return h(
      "section",
      { className: "stack" },
      h(
        "div",
        { className: "panel empty-state" },
        h("p", { className: "eyebrow", text: "오늘의 시작점" }),
        h("h1", { text: `${props.profile.desiredRole} 준비를 작게 시작합니다.` }),
        h(
          "p",
          {
            className: "lead",
            text: `${props.profile.region} / ${props.profile.desiredWorkType} 조건과 오늘 에너지 수준을 반영해 mock 퀘스트 3개를 만듭니다.`,
          },
        ),
        button("오늘의 퀘스트 생성", "primary", props.onGenerate),
      ),
    );
  }

  return h(
    "section",
    { className: "stack" },
    h(
      "div",
      { className: "section-heading" },
      h("div", {}, h("p", { className: "eyebrow", text: "오늘의 퀘스트" }), h("h1", { text: "작은 실행 3개" })),
      button("대시보드 보기", "secondary", props.onOpenDashboard),
    ),
    h(
      "div",
      { className: "quest-list" },
      ...generatedQuests.map((quest) =>
        renderQuestCard({
          quest,
          showActions: true,
          onComplete: props.onComplete,
          onStartFailure: props.onStartFailure,
          failureForm:
            props.activeFailureQuestId === quest.id
              ? renderFailureReasonForm({
                  onCancel: props.onCancelFailure,
                  onSubmit: (reason, note) => props.onSubmitFailure(quest.id, reason, note),
                })
              : undefined,
        }),
      ),
    ),
    redesignedQuests.length > 0
      ? h(
          "div",
          { className: "stack" },
          h(
            "div",
            { className: "section-heading compact-heading" },
            h("div", {}, h("p", { className: "eyebrow", text: "더 쉬운 다음 행동" }), h("h2", { text: "재설계 결과" })),
          ),
          h(
            "div",
            { className: "quest-list two-column" },
            ...redesignedQuests.map((quest) =>
              renderQuestCard({
                quest,
                showActions: true,
                onComplete: props.onComplete,
                onStartFailure: props.onStartFailure,
              }),
            ),
          ),
        )
      : null,
  );
}
