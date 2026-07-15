import { button, h } from "../../../shared/dom.js";
import {
  categoryLabels,
  difficultyLabels,
  statusLabels,
  type DailyQuest,
} from "../types.js";

type QuestCardProps = {
  quest: DailyQuest;
  showActions: boolean;
  onComplete: (questId: string) => void;
  onStartFailure: (questId: string) => void;
  failureForm?: HTMLElement;
};

export function renderQuestCard(props: QuestCardProps): HTMLElement {
  const { quest } = props;
  const actions =
    props.showActions && quest.status === "TODO"
      ? h(
          "div",
          { className: "action-row" },
          button("완료", "primary", () => props.onComplete(quest.id)),
          quest.origin === "GENERATED"
            ? button("더 작게 나누기", "secondary", () => props.onStartFailure(quest.id))
            : null,
        )
      : h("p", { className: "status-note", text: statusLabels[quest.status] });

  return h(
    "article",
    { className: `quest-card ${quest.origin === "REDESIGNED" ? "quest-card-soft" : ""}` },
    h(
      "div",
      { className: "quest-card-header" },
      h("h3", { text: quest.title }),
      h("span", { className: "status-pill", text: statusLabels[quest.status] }),
    ),
    h("p", { className: "quest-description", text: quest.description }),
    h(
      "dl",
      { className: "quest-meta" },
      meta("분류", categoryLabels[quest.category]),
      meta("난이도", difficultyLabels[quest.difficulty]),
      meta("예상", `${quest.estimatedMinutes}분`),
    ),
    h("p", { className: "criteria", text: `완료 기준: ${quest.completionCriteria}` }),
    actions,
    props.failureForm,
  );
}

function meta(label: string, value: string): HTMLElement {
  return h("div", {}, h("dt", { text: label }), h("dd", { text: value }));
}
