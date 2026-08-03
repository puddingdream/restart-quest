import type { QuestErrorFeedback } from '../questErrorFeedback'
import {
  ENERGY_LABELS,
  type DailyQuestResponse,
  type EnergyLevel,
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
  onEnergyChange: (energyLevel: EnergyLevel) => void
  onGenerate: () => void
  onRetry: () => void
}

export function TodayQuestContent({
  plan,
  selectedEnergy,
  validationError,
  error,
  isLoading,
  isGenerating,
  onEnergyChange,
  onGenerate,
  onRetry,
}: TodayQuestContentProps) {
  if (isLoading) {
    return <QuestSkeletons label="오늘의 기존 계획을 확인하고 있어요." />
  }

  if (plan) {
    return (
      <section className="quest-plan" aria-labelledby="quest-plan-title">
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
              다시 시도
            </button>
          </div>
        </div>
      )}
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
    </div>
  )
}
