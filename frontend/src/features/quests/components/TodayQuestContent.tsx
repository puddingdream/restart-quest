import type { QuestErrorFeedback } from '../questErrorFeedback'
import type { QuestOutcomeErrorFeedback } from '../questOutcomeErrorFeedback'
import {
  ENERGY_LABELS,
  type DailyQuestResponse,
  type EnergyLevel,
  type QuestJourney,
  type RedesignQuestRequest,
} from '../types'
import { EnergySelector } from './EnergySelector'
import { QuestCard } from './QuestCard'
import { QuestSkeletons } from './QuestSkeletons'

interface TodayQuestContentProps {
  plan: DailyQuestResponse | null
  selectedEnergy: EnergyLevel | null
  validationError: string | null
  error: QuestErrorFeedback | null
  isLoading: boolean
  isGenerating: boolean
  outcomeAnnouncement: string | null
  onEnergyChange: (energyLevel: EnergyLevel) => void
  onGenerate: () => void
  onRetry: () => void
  isQuestPending: (questId: string) => boolean
  getOutcomeError: (questId: string) => QuestOutcomeErrorFeedback | null
  onComplete: (journey: QuestJourney) => Promise<boolean>
  onRedesign: (
    journey: QuestJourney,
    input: RedesignQuestRequest,
  ) => Promise<boolean>
  onRefresh: () => void
  onClearOutcomeError: (questId: string) => void
}

export function TodayQuestContent({
  plan,
  selectedEnergy,
  validationError,
  error,
  isLoading,
  isGenerating,
  outcomeAnnouncement,
  onEnergyChange,
  onGenerate,
  onRetry,
  isQuestPending,
  getOutcomeError,
  onComplete,
  onRedesign,
  onRefresh,
  onClearOutcomeError,
}: TodayQuestContentProps) {
  if (isLoading) {
    return <QuestSkeletons label="오늘의 기존 계획을 확인하고 있어요." />
  }

  if (plan) {
    return (
      <section className="quest-plan" aria-labelledby="quest-plan-title">
        <p className="visually-hidden" role="status" aria-live="polite">
          {outcomeAnnouncement}
        </p>
        <div className="quest-plan-heading">
          <div>
            <p className="eyebrow">오늘의 세 여정</p>
            <h2 id="quest-plan-title">한 번에 하나씩 시작해 보세요</h2>
          </div>
          <p>
            {plan.date} · {plan.energyLevel ? ENERGY_LABELS[plan.energyLevel] : ''}
          </p>
        </div>
        <ol className="quest-grid" aria-label="오늘의 퀘스트 세 개">
          {plan.journeys.map((journey, index) => (
            <QuestCard
              journey={journey}
              position={index + 1}
              key={journey.journeyId}
              isPending={isQuestPending(journey.currentQuest.id)}
              error={getOutcomeError(journey.currentQuest.id)}
              onComplete={onComplete}
              onRedesign={onRedesign}
              onRefresh={onRefresh}
              onClearError={onClearOutcomeError}
            />
          ))}
        </ol>
      </section>
    )
  }

  return (
    <div className="quest-setup">
      {error && (
        <div className="alert alert-error quest-error" role="alert">
          <span aria-hidden="true">!</span>
          <div>
            <strong>{error.title}</strong>
            <p>{error.message}</p>
            <button
              className="text-retry"
              type="button"
              onClick={onRetry}
              disabled={isGenerating}
            >
              {error.action === 'login' ? '다시 로그인' : '다시 시도'}
            </button>
          </div>
        </div>
      )}
      {error?.action !== 'login' && (
        <>
          <EnergySelector
            selectedEnergy={selectedEnergy}
            validationError={validationError}
            isSubmitting={isGenerating}
            onChange={onEnergyChange}
            onSubmit={onGenerate}
          />
          {isGenerating && (
            <QuestSkeletons label="오늘의 퀘스트 세 개를 만들고 있어요." />
          )}
        </>
      )}
    </div>
  )
}
