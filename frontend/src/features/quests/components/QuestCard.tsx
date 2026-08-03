import { CATEGORY_LABELS, type QuestJourney } from '../types'

interface QuestCardProps {
  journey: QuestJourney
  position: number
}

export function QuestCard({ journey, position }: QuestCardProps) {
  const quest = journey.currentQuest
  const titleId = `quest-${journey.journeyId}-title`

  return (
    <li>
      <article className="quest-card" aria-labelledby={titleId}>
        <div className="quest-card-meta">
          <span>여정 {position}</span>
          <span>{CATEGORY_LABELS[quest.category]}</span>
          <span>{quest.estimatedMinutes}분</span>
        </div>
        <h2 id={titleId}>{quest.title}</h2>
        <p className="quest-description">{quest.description}</p>
        <div className="completion-criteria">
          <strong>완료 기준</strong>
          <p>{quest.completionCriteria}</p>
        </div>
        <div className="quest-steps">
          <h3>이렇게 시작해 보세요</h3>
          <ol>
            {quest.steps.map((step, index) => (
              <li key={`${quest.id}-step-${index}`}>{step}</li>
            ))}
          </ol>
        </div>
      </article>
    </li>
  )
}
