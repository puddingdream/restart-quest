import { useState, useSyncExternalStore, type FormEvent } from 'react'
import type { AvailableMinutes, EnergyLevel, GoalType } from '../../api/contracts'
import { AppShell } from '../../components/AppShell'
import { Button } from '../../components/Button'
import { Feedback } from '../../components/Feedback'
import type { JourneyStore } from '../../state/journeyStore'
import { JourneyFeedback } from './JourneyFeedback'
import { energyOptions, goalOptions, minuteOptions } from './journeyOptions'

export function StartPage({
  notice,
  store,
}: {
  notice: string | null
  store: JourneyStore
}) {
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState)
  const [goalType, setGoalType] = useState<GoalType>()
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>()
  const [availableMinutes, setAvailableMinutes] = useState<AvailableMinutes>()
  const [showValidation, setShowValidation] = useState(false)
  const isCreating = state.mutation.status === 'pending'
    && state.mutation.command.kind === 'create'

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!goalType || !energyLevel || !availableMinutes) {
      setShowValidation(true)
      return
    }

    setShowValidation(false)
    void store.createJourney({ goalType, energyLevel, availableMinutes })
  }

  return (
    <AppShell>
      <section className="setup-page" aria-labelledby="setup-title">
        <div className="journey-heading">
          <p className="eyebrow">작은 행동 설정</p>
          <h1 id="setup-title">오늘 가능한 만큼만 알려 주세요</h1>
          <p>정답은 없어요. 목표와 에너지, 가능한 시간 세 가지만 선택하면 됩니다.</p>
        </div>

        {notice && (
          <Feedback title="새 여정을 준비했어요">
            <p>{notice}</p>
          </Feedback>
        )}

        {showValidation && (
          <Feedback tone="error" title="세 가지 선택을 확인해 주세요">
            <p>목표, 에너지, 가능한 시간을 하나씩 선택해 주세요.</p>
          </Feedback>
        )}

        <JourneyFeedback mutation={state.mutation} onRetry={() => void store.retryMutation()} />

        <form className="setup-form" onSubmit={handleSubmit} noValidate>
          <fieldset className="choice-group">
            <legend>어떤 목표를 다시 잇고 싶나요?</legend>
            <div className="choice-list">
              {goalOptions.map((option) => (
                <label className="choice-card" key={option.value}>
                  <input
                    checked={goalType === option.value}
                    name="goalType"
                    onChange={() => setGoalType(option.value)}
                    type="radio"
                    value={option.value}
                  />
                  <span><strong>{option.label}</strong><small>{option.hint}</small></span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="choice-group">
            <legend>지금 에너지는 어떤가요?</legend>
            <div className="choice-list">
              {energyOptions.map((option) => (
                <label className="choice-card" key={option.value}>
                  <input
                    checked={energyLevel === option.value}
                    name="energyLevel"
                    onChange={() => setEnergyLevel(option.value)}
                    type="radio"
                    value={option.value}
                  />
                  <span><strong>{option.label}</strong><small>{option.hint}</small></span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="choice-group">
            <legend>얼마나 시간을 쓸 수 있나요?</legend>
            <div className="choice-list choice-list--compact">
              {minuteOptions.map((option) => (
                <label className="choice-card choice-card--compact" key={option.value}>
                  <input
                    checked={availableMinutes === option.value}
                    name="availableMinutes"
                    onChange={() => setAvailableMinutes(option.value)}
                    type="radio"
                    value={option.value}
                  />
                  <span><strong>{option.label}</strong></span>
                </label>
              ))}
            </div>
          </fieldset>

          <Button isLoading={isCreating} loadingLabel="작은 행동 만드는 중…" type="submit">
            작은 행동 확인하기
          </Button>
        </form>
      </section>
    </AppShell>
  )
}
