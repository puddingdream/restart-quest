import type { FormEvent } from 'react'
import {
  ENERGY_LEVELS,
  ENERGY_LABELS,
  type EnergyLevel,
} from '../types'

const ENERGY_HINTS: Record<EnergyLevel, string> = {
  LOW: '부담 없는 10분 행동부터',
  MEDIUM: '한 걸음 더 나아가는 행동',
  HIGH: '집중해서 이어가는 행동',
}

interface EnergySelectorProps {
  selectedEnergy: EnergyLevel | null
  validationError: string | null
  isSubmitting: boolean
  onChange: (energyLevel: EnergyLevel) => void
  onSubmit: () => void
}

export function EnergySelector({
  selectedEnergy,
  validationError,
  isSubmitting,
  onChange,
  onSubmit,
}: EnergySelectorProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isSubmitting) onSubmit()
  }

  return (
    <form className="energy-form surface-card" onSubmit={handleSubmit} noValidate>
      <fieldset
        disabled={isSubmitting}
        aria-describedby={validationError ? 'energy-help energy-error' : 'energy-help'}
      >
        <legend>오늘 가능한 에너지</legend>
        <p id="energy-help">
          컨디션을 평가하는 값이 아니에요. 오늘 부담 없이 가능한 크기를 골라주세요.
        </p>
        <div className="energy-options">
          {ENERGY_LEVELS.map((energyLevel) => (
            <label key={energyLevel}>
              <input
                type="radio"
                name="energyLevel"
                value={energyLevel}
                checked={selectedEnergy === energyLevel}
                onChange={() => onChange(energyLevel)}
                aria-invalid={Boolean(validationError)}
              />
              <span>
                <strong>{ENERGY_LABELS[energyLevel]}</strong>
                <small>{ENERGY_HINTS[energyLevel]}</small>
              </span>
            </label>
          ))}
        </div>
        {validationError && (
          <p className="field-error" id="energy-error" role="alert">
            {validationError}
          </p>
        )}
      </fieldset>
      <button className="button button-primary" disabled={isSubmitting}>
        {isSubmitting && <span className="spinner" aria-hidden="true" />}
        {isSubmitting ? '오늘 퀘스트를 만들고 있어요' : '오늘 퀘스트 만들기'}
      </button>
    </form>
  )
}
