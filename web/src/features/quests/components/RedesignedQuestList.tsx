import { categoryLabel, difficultyLabel } from "../questLabels";
import { DailyQuest } from "../types";

type RedesignedQuestListProps = {
  quests: DailyQuest[];
  onCompleteQuest: (questId: string) => void;
};

export function RedesignedQuestList({
  quests,
  onCompleteQuest,
}: RedesignedQuestListProps) {
  if (quests.length === 0) {
    return null;
  }

  return (
    <section className="flow-section muted-section" aria-labelledby="redesign-title">
      <div className="section-heading">
        <p className="eyebrow">다음 행동</p>
        <h2 id="redesign-title">더 작게 나눈 퀘스트</h2>
        <p>원래 목표는 유지하고, 바로 시작할 수 있는 크기로 낮췄습니다.</p>
      </div>

      <div className="redesign-grid">
        {quests.map((quest) => (
          <article key={quest.id} className="mini-quest">
            <p className="quest-meta">
              {categoryLabel[quest.category]} · {difficultyLabel[quest.difficulty]} ·{" "}
              {quest.estimatedMinutes}분
            </p>
            <h3>{quest.title}</h3>
            <p>{quest.description}</p>
            <p className="criteria">
              <strong>완료 기준</strong>
              <span>{quest.completionCriteria}</span>
            </p>
            <button
              className="secondary-button"
              disabled={quest.status !== "TODO"}
              type="button"
              onClick={() => onCompleteQuest(quest.id)}
            >
              이 행동 완료
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
