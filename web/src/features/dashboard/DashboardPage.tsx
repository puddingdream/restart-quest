import { OnboardingProfile } from "../onboarding/types";
import { categoryLabel, difficultyLabel, failureReasonLabel } from "../quests/questLabels";
import { DashboardSummary } from "./dashboardModel";

type DashboardPageProps = {
  profile: OnboardingProfile;
  summary: DashboardSummary;
  onBackToQuests: () => void;
};

export function DashboardPage({
  profile,
  summary,
  onBackToQuests,
}: DashboardPageProps) {
  return (
    <section className="flow-section" aria-labelledby="dashboard-title">
      <div className="section-heading">
        <p className="eyebrow">대시보드</p>
        <h2 id="dashboard-title">오늘 다시 이어갈 행동</h2>
        <p>
          {profile.desiredJob} 준비 흐름에서 완료한 행동과 더 작게 나눈 행동을
          함께 보여줍니다.
        </p>
      </div>

      <div className="summary-grid" aria-live="polite">
        <div className="summary-tile">
          <span>오늘 진행률</span>
          <strong>{summary.progressPercent}%</strong>
          <small>
            원래 퀘스트 {summary.completedOriginalQuests}/{summary.totalOriginalQuests}
            개 완료
          </small>
        </div>
        <div className="summary-tile">
          <span>더 작게 나눈 원 퀘스트</span>
          <strong>{summary.redesignedOriginalQuests}</strong>
          <small>막힌 지점은 다음 행동으로 전환했습니다</small>
        </div>
        <div className="summary-tile">
          <span>완료한 작은 행동</span>
          <strong>{summary.completedRedesignedQuests}</strong>
          <small>재설계된 행동 완료 수</small>
        </div>
      </div>

      <div className="dashboard-focus">
        <div>
          <p className="eyebrow">다음 행동</p>
          {summary.nextAction ? (
            <>
              <h3>{summary.nextAction.title}</h3>
              <p>{summary.nextAction.description}</p>
              <p className="quest-meta">
                {categoryLabel[summary.nextAction.category]} ·{" "}
                {difficultyLabel[summary.nextAction.difficulty]} ·{" "}
                {summary.nextAction.estimatedMinutes}분
              </p>
            </>
          ) : (
            <>
              <h3>오늘 남은 퀘스트가 없습니다</h3>
              <p>필요하면 온보딩 값을 조정하고 새 퀘스트를 다시 만들 수 있습니다.</p>
            </>
          )}
        </div>
        <button className="primary-button" type="button" onClick={onBackToQuests}>
          퀘스트로 돌아가기
        </button>
      </div>

      <section className="history-section" aria-labelledby="history-title">
        <div className="section-heading compact">
          <p className="eyebrow">재설계 기록</p>
          <h3 id="history-title">막힌 퀘스트를 어떻게 줄였는지</h3>
        </div>

        {summary.redesignHistory.length === 0 ? (
          <p className="empty-copy">아직 더 작게 나눈 기록이 없습니다.</p>
        ) : (
          <ul className="history-list">
            {summary.redesignHistory.map((item) => (
              <li key={item.originalQuestId}>
                <strong>{item.originalTitle}</strong>
                <span>{failureReasonLabel[item.reason]}</span>
                <small>{item.redesignedTitles.join(", ")}</small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
