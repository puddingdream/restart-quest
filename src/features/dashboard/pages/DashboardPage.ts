import { button, h } from "../../../shared/dom.js";
import { categoryLabels, failureReasonLabels, type DailyQuest, type RedesignRecord } from "../../quests/types.js";
import { createDashboardSummary } from "../services/dashboardSummary.js";

type DashboardPageProps = {
  quests: DailyQuest[];
  redesignRecords: RedesignRecord[];
  onOpenQuests: () => void;
};

export function renderDashboardPage(props: DashboardPageProps): HTMLElement {
  const summary = createDashboardSummary(props.quests, props.redesignRecords);

  return h(
    "section",
    { className: "stack dashboard-page" },
    h(
      "div",
      { className: "section-heading" },
      h("div", {}, h("p", { className: "eyebrow", text: "대시보드" }), h("h1", { text: "오늘의 재진입 흐름" })),
      button("퀘스트로 돌아가기", "secondary", props.onOpenQuests),
    ),
    h(
      "div",
      { className: "dashboard-grid" },
      progressPanel(summary.progressPercent),
      statPanel("완료", `${summary.doneCount}/${summary.generatedTotal}`),
      statPanel("남은 원 퀘스트", `${summary.openCount}`),
      statPanel("더 작게 나눈 퀘스트", `${summary.redesignedCount}`),
    ),
    nextActionPanel(summary.nextAction),
    redesignHistory(summary.redesignRecords),
  );
}

function progressPanel(percent: number): HTMLElement {
  return h(
    "article",
    { className: "panel metric-panel progress-panel" },
    h("p", { className: "metric-label", text: "오늘 완료율" }),
    h("strong", { text: `${percent}%` }),
    h("div", { className: "progress-track" }, h("span", { attrs: { style: `width: ${percent}%` } })),
  );
}

function statPanel(label: string, value: string): HTMLElement {
  return h(
    "article",
    { className: "panel metric-panel" },
    h("p", { className: "metric-label", text: label }),
    h("strong", { text: value }),
  );
}

function nextActionPanel(nextAction: DailyQuest | null): HTMLElement {
  return h(
    "article",
    { className: "panel next-action" },
    h("p", { className: "eyebrow", text: "다음 행동" }),
    nextAction
      ? h(
          "div",
          {},
          h("h2", { text: nextAction.title }),
          h("p", { text: nextAction.description }),
          h(
            "p",
            {
              className: "criteria",
              text: `${categoryLabels[nextAction.category]} / ${nextAction.estimatedMinutes}분 / ${nextAction.completionCriteria}`,
            },
          ),
        )
      : h("p", { text: "오늘 만든 원 퀘스트가 모두 정리되었습니다." }),
  );
}

function redesignHistory(records: RedesignRecord[]): HTMLElement {
  return h(
    "section",
    { className: "panel history-panel" },
    h("div", { className: "section-heading compact-heading" }, h("h2", { text: "재설계 기록" })),
    records.length === 0
      ? h("p", { className: "muted", text: "아직 더 작게 나눈 퀘스트가 없습니다." })
      : h(
          "ul",
          { className: "history-list" },
          ...records.map((record) =>
            h(
              "li",
              {},
              h("strong", { text: record.sourceTitle }),
              h("span", { text: `${failureReasonLabels[record.reason]} -> ${record.redesignedQuestIds.length}개 행동` }),
              record.note ? h("small", { text: record.note }) : null,
            ),
          ),
        ),
  );
}
