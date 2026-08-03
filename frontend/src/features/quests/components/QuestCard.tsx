import { useRef, useState } from 'react'
import type { QuestOutcomeErrorFeedback } from '../questOutcomeErrorFeedback'
import {
  CATEGORY_LABELS,
  type QuestJourney,
  type RedesignQuestRequest,
} from '../types'
import { QuestRedesignDialog } from './QuestRedesignDialog'

interface QuestCardProps {
  journey: QuestJourney
  position: number
  isPending: boolean
  error: QuestOutcomeErrorFeedback | null
  onComplete: (journey: QuestJourney) => Promise<boolean>
  onRedesign: (
    journey: QuestJourney,
    input: RedesignQuestRequest,
  ) => Promise<boolean>
  onRefresh: () => void
  onClearError: (questId: string) => void
}

export function QuestCard({
  journey,
  position,
  isPending,
  error,
  onComplete,
  onRedesign,
  onRefresh,
  onClearError,
}: QuestCardProps) {
  const quest = journey.currentQuest
  const titleId = `quest-${journey.journeyId}-title`
  const redesignTriggerRef = useRef<HTMLButtonElement>(null)
  const [isRedesignOpen, setIsRedesignOpen] = useState(false)
  const previousQuests = journey.history.filter(
    (historyQuest) => historyQuest.id !== quest.id,
  )

  function closeRedesign() {
    setIsRedesignOpen(false)
    window.setTimeout(() => redesignTriggerRef.current?.focus(), 0)
  }

  return (
    <li>
      <article
        className={
          journey.status === 'COMPLETED'
            ? 'quest-card quest-card-completed'
            : 'quest-card'
        }
        aria-labelledby={titleId}
        aria-busy={isPending}
      >
        <div className="quest-card-meta">
          <span>여정 {position}</span>
          <span>{CATEGORY_LABELS[quest.category]}</span>
          <span>{quest.estimatedMinutes}분</span>
          {journey.status === 'COMPLETED' && (
            <span className="quest-status-done">오늘 여정 완료</span>
          )}
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

        {previousQuests.length > 0 && (
          <details className="quest-history">
            <summary>바꾼 기록 보기 ({previousQuests.length})</summary>
            <ol>
              {previousQuests.map((previousQuest) => (
                <li key={previousQuest.id}>
                  <span>이전 행동</span>
                  <strong>{previousQuest.title}</strong>
                </li>
              ))}
            </ol>
          </details>
        )}

        {error?.source === 'completion' && (
          <div className="alert alert-error outcome-error" role="alert">
            <span aria-hidden="true">!</span>
            <div>
              <strong>{error.title}</strong>
              <p>{error.message}</p>
              <button
                className="text-retry"
                type="button"
                onClick={() => {
                  if (error.action === 'refresh') onRefresh()
                  else void onComplete(journey)
                }}
                disabled={isPending}
              >
                {error.action === 'refresh' ? '오늘 목록 다시 확인' : '다시 시도'}
              </button>
            </div>
          </div>
        )}

        {journey.status === 'ACTIVE' ? (
          <div className="quest-actions">
            <button
              className="button button-primary"
              type="button"
              onClick={() => void onComplete(journey)}
              disabled={isPending}
            >
              {isPending && <span className="spinner" aria-hidden="true" />}
              {isPending ? '반영 중' : '완료했어요'}
            </button>
            <button
              ref={redesignTriggerRef}
              className="button button-secondary"
              type="button"
              onClick={() => {
                onClearError(quest.id)
                setIsRedesignOpen(true)
              }}
              disabled={isPending}
            >
              더 작게 바꾸기
            </button>
          </div>
        ) : (
          <p className="quest-complete-copy" role="status">
            오늘 가능한 만큼 마쳤어요. 다음 여정으로 이어가도 좋아요.
          </p>
        )}
      </article>

      {isRedesignOpen && (
        <QuestRedesignDialog
          quest={quest}
          isSubmitting={isPending}
          error={error?.source === 'redesign' ? error : null}
          onClose={closeRedesign}
          onSubmit={(input) => onRedesign(journey, input)}
          onRefresh={onRefresh}
          onClearError={() => onClearError(quest.id)}
        />
      )}
    </li>
  )
}
