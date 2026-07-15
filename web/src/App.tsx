import { useState } from "react";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { buildDashboardSummary } from "./features/dashboard/dashboardModel";
import { OnboardingPage } from "./features/onboarding/OnboardingPage";
import { TodayQuestPage } from "./features/quests/TodayQuestPage";
import { useQuestFlow } from "./features/quests/hooks/useQuestFlow";

type AppView = "onboarding" | "quests" | "dashboard";

export function App() {
  const questFlow = useQuestFlow();
  const [view, setView] = useState<AppView>("onboarding");
  const dashboard = buildDashboardSummary(
    questFlow.quests,
    questFlow.redesignedQuests,
    questFlow.redesignHistory,
  );

  const canShowQuestViews = questFlow.profile !== null;

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Re:Start Quest</p>
          <h1>오늘 다시 시작할 수 있는 작은 구직 행동</h1>
        </div>
        <nav aria-label="주요 화면" className="top-nav">
          <button
            className={view === "onboarding" ? "nav-button active" : "nav-button"}
            type="button"
            onClick={() => setView("onboarding")}
          >
            온보딩
          </button>
          <button
            className={view === "quests" ? "nav-button active" : "nav-button"}
            disabled={!canShowQuestViews}
            type="button"
            onClick={() => setView("quests")}
          >
            오늘 퀘스트
          </button>
          <button
            className={view === "dashboard" ? "nav-button active" : "nav-button"}
            disabled={!canShowQuestViews}
            type="button"
            onClick={() => setView("dashboard")}
          >
            대시보드
          </button>
        </nav>
      </header>

      {view === "onboarding" && (
        <OnboardingPage
          savedProfile={questFlow.profile}
          onSubmit={(profile) => {
            questFlow.saveProfile(profile);
            setView("quests");
          }}
        />
      )}

      {view === "quests" && questFlow.profile && (
        <TodayQuestPage
          profile={questFlow.profile}
          quests={questFlow.quests}
          redesignedQuests={questFlow.redesignedQuests}
          onCompleteQuest={questFlow.completeQuest}
          onGenerateQuests={questFlow.generateQuests}
          onOpenDashboard={() => setView("dashboard")}
          onRedesignQuest={questFlow.redesignQuest}
        />
      )}

      {view === "dashboard" && questFlow.profile && (
        <DashboardPage
          profile={questFlow.profile}
          summary={dashboard}
          onBackToQuests={() => setView("quests")}
        />
      )}
    </main>
  );
}
