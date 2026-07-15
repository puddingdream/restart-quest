import { categoryLabel, difficultyLabel, statusLabel } from "../questLabels";
import { DailyQuest } from "../types";

type QuestCardProps = {
  quest: DailyQuest;
  onComplete: (questId: string) => void;
  onOpenFailure: (questId: string) => void;
};

export function QuestCard({ quest, onComplete, onOpenFailure }: QuestCardProps) {
  const canAct = quest.status === "TODO";

  return (
    <article className="quest-card" aria-labelledby={`${quest.id}-title`}>
      <div className="quest-card-header">
        <div>
          <p className="quest-meta">
            {categoryLabel[quest.category]} · {difficultyLabel[quest.difficulty]} ·{" "}
            {quest.estimatedMinutes}분
          </p>
          <h3 id={`${quest.id}-title`}>{quest.title}</h3>
        </div>
        <span className={`status-badge status-${quest.status.toLowerCase()}`}>
          {statusLabel[quest.status]}
        </span>
      </div>

      <p>{quest.description}</p>
      <p className="criteria">
        <strong>완료 기준</strong>
        <span>{quest.completionCriteria}</span>
      </p>

      {quest.failureNote && (
        <p className="note-line">다시 나눌 때 남긴 메모: {quest.failureNote}</p>
      )}

      <div className="quest-actions">
        <button
          className="secondary-button"
          disabled={!canAct}
          type="button"
          onClick={() => onOpenFailure(quest.id)}
        >
          더 작게 나누기
        </button>
        <button
          className="primary-button"
          disabled={!canAct}
          type="button"
          onClick={() => onComplete(quest.id)}
        >
          완료
        </button>
      </div>
    </article>
  );
}
