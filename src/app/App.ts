import { clear, h } from "../shared/dom.js";
import { renderDashboardPage } from "../features/dashboard/pages/DashboardPage.js";
import { renderOnboardingPage } from "../features/onboarding/pages/OnboardingPage.js";
import type { OnboardingProfile } from "../features/onboarding/types.js";
import { renderTodayQuestPage } from "../features/quests/pages/TodayQuestPage.js";
import { generateDailyQuests, redesignQuest } from "../features/quests/services/mockQuestService.js";
import type { DailyQuest, FailureReason, RedesignRecord } from "../features/quests/types.js";

type Screen = "onboarding" | "quests" | "dashboard";

type AppState = {
  screen: Screen;
  profile: OnboardingProfile | null;
  quests: DailyQuest[];
  redesignRecords: RedesignRecord[];
  activeFailureQuestId: string | null;
};

export class App {
  private state: AppState = {
    screen: "onboarding",
    profile: null,
    quests: [],
    redesignRecords: [],
    activeFailureQuestId: null,
  };

  constructor(private readonly root: HTMLElement) {}

  render(): void {
    clear(this.root);
    this.root.append(this.renderShell());
  }

  private renderShell(): HTMLElement {
    return h(
      "div",
      { className: "app-shell" },
      h(
        "header",
        { className: "topbar" },
        h("div", {}, h("p", { className: "brand", text: "Re:Start Quest" }), h("span", { text: "핵심 재진입 루프 mock" })),
        this.renderNav(),
      ),
      h("main", { className: "main-content" }, this.renderScreen()),
    );
  }

  private renderNav(): HTMLElement {
    return h(
      "nav",
      { className: "nav-tabs", attrs: { "aria-label": "주요 화면" } },
      this.navButton("온보딩", "onboarding", true),
      this.navButton("오늘 퀘스트", "quests", Boolean(this.state.profile)),
      this.navButton("대시보드", "dashboard", this.state.quests.length > 0),
    );
  }

  private navButton(label: string, screen: Screen, enabled: boolean): HTMLButtonElement {
    const button = h(
      "button",
      {
        className: this.state.screen === screen ? "nav-tab active" : "nav-tab",
        attrs: { type: "button", disabled: !enabled },
        onClick: () => {
          if (!enabled) {
            return;
          }
          this.setState({ screen, activeFailureQuestId: null });
        },
      },
      label,
    );
    return button;
  }

  private renderScreen(): HTMLElement {
    if (this.state.screen === "onboarding" || !this.state.profile) {
      return renderOnboardingPage({
        onSubmit: (profile) => {
          this.setState({
            profile,
            quests: [],
            redesignRecords: [],
            activeFailureQuestId: null,
            screen: "quests",
          });
        },
      });
    }

    if (this.state.screen === "dashboard") {
      return renderDashboardPage({
        quests: this.state.quests,
        redesignRecords: this.state.redesignRecords,
        onOpenQuests: () => this.setState({ screen: "quests" }),
      });
    }

    return renderTodayQuestPage({
      profile: this.state.profile,
      quests: this.state.quests,
      activeFailureQuestId: this.state.activeFailureQuestId,
      onGenerate: () => this.generateQuests(),
      onComplete: (questId) => this.completeQuest(questId),
      onStartFailure: (questId) => this.setState({ activeFailureQuestId: questId }),
      onCancelFailure: () => this.setState({ activeFailureQuestId: null }),
      onSubmitFailure: (questId, reason, note) => this.submitFailure(questId, reason, note),
      onOpenDashboard: () => this.setState({ screen: "dashboard", activeFailureQuestId: null }),
    });
  }

  private generateQuests(): void {
    if (!this.state.profile) {
      return;
    }
    this.setState({
      quests: generateDailyQuests(this.state.profile),
      redesignRecords: [],
      activeFailureQuestId: null,
    });
  }

  private completeQuest(questId: string): void {
    this.setState({
      quests: this.state.quests.map((quest) =>
        quest.id === questId ? { ...quest, status: "DONE" } : quest,
      ),
      activeFailureQuestId: null,
    });
  }

  private submitFailure(questId: string, reason: FailureReason, note: string): void {
    const source = this.state.quests.find((quest) => quest.id === questId);
    if (!source) {
      return;
    }

    const redesigned = redesignQuest(source, reason, note);
    const updatedSource: DailyQuest = {
      ...source,
      status: "REDESIGNED",
      failureReason: reason,
      note: note.trim() || undefined,
    };
    const record: RedesignRecord = {
      id: `record-${this.state.redesignRecords.length + 1}`,
      sourceQuestId: source.id,
      sourceTitle: source.title,
      reason,
      note: note.trim() || undefined,
      redesignedQuestIds: redesigned.map((quest) => quest.id),
      createdAtLabel: "오늘",
    };

    this.setState({
      quests: this.state.quests.map((quest) => (quest.id === questId ? updatedSource : quest)).concat(redesigned),
      redesignRecords: this.state.redesignRecords.concat(record),
      activeFailureQuestId: null,
      screen: "dashboard",
    });
  }

  private setState(nextState: Partial<AppState>): void {
    this.state = { ...this.state, ...nextState };
    this.render();
  }
}
