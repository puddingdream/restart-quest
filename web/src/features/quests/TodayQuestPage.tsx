import { useState } from "react";
import { OnboardingProfile } from "../onboarding/types";
import { FailureReasonPanel } from "./components/FailureReasonPanel";
import { QuestCard } from "./components/QuestCard";
import { RedesignedQuestList } from "./components/RedesignedQuestList";
import { DailyQuest, FailureSubmission } from "./types";

type TodayQuestPageProps = {
  profile: OnboardingProfile;
  quests: DailyQuest[];
  redesignedQuests: DailyQuest[];
  onCompleteQuest: (questId: string) => void;
  onGenerateQuests: () => void;
  onOpenDashboard: () => void;
  onRedesignQuest: (questId: string, submission: FailureSubmission) => void;
};

export function TodayQuestPage({
  profile,
  quests,
  redesignedQuests,
  onCompleteQuest,
  onGenerateQuests,
  onOpenDashboard,
  onRedesignQuest,
}: TodayQuestPageProps) {
  const [activeFailureQuestId, setActiveFailureQuestId] = useState<string | null>(null);
  const activeFailureQuest = quests.find((quest) => quest.id === activeFailureQuestId);

  return (
    <>
      <section className="flow-section" aria-labelledby="quest-title">
        <div className="section-heading">
          <p className="eyebrow">오늘 퀘스트</p>
          <h2 id="quest-title">{profile.desiredJob} 준비를 오늘 크기로 줄이기</h2>
          <p>
            {profile.region} · {profile.desiredWorkType} · 공백 {profile.careerGapMonths}
            개월 기준으로 mock 퀘스트를 생성합니다.
          </p>
        </div>

        {quests.length === 0 ? (
          <div className="empty-state" aria-live="polite">
            <h3>아직 오늘 퀘스트가 없습니다</h3>
            <p>3개의 작은 행동을 만들고, 막히면 바로 더 쉬운 행동으로 나눕니다.</p>
            <button className="primary-button" type="button" onClick={onGenerateQuests}>
              오늘의 퀘스트 생성
            </button>
          </div>
        ) : (
          <>
            <div className="quest-grid" aria-live="polite">
              {quests.map((quest) => (
                <QuestCard
                  key={quest.id}
                  quest={quest}
                  onComplete={onCompleteQuest}
                  onOpenFailure={setActiveFailureQuestId}
                />
              ))}
            </div>

            {activeFailureQuest && (
              <FailureReasonPanel
                quest={activeFailureQuest}
                onCancel={() => setActiveFailureQuestId(null)}
                onSubmit={(submission) => {
                  onRedesignQuest(activeFailureQuest.id, submission);
                  setActiveFailureQuestId(null);
                }}
              />
            )}

            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={onOpenDashboard}>
                대시보드 확인
              </button>
            </div>
          </>
        )}
      </section>

      <RedesignedQuestList
        quests={redesignedQuests}
        onCompleteQuest={onCompleteQuest}
      />
    </>
  );
}
