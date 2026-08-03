import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { QuestOutcomeErrorFeedback } from '../questOutcomeErrorFeedback'
import {
  QUEST_REASON_NOTE_MAX_LENGTH,
  toRedesignQuestRequest,
  validateRedesignForm,
  type RedesignFormErrors,
} from '../questOutcomeValidation'
import {
  QUEST_FAILURE_REASONS,
  QUEST_FAILURE_REASON_LABELS,
  type Quest,
  type QuestFailureReasonCode,
  type RedesignQuestRequest,
} from '../types'

interface QuestRedesignDialogProps {
  quest: Quest
  isSubmitting: boolean
  error: QuestOutcomeErrorFeedback | null
  onClose: () => void
  onSubmit: (input: RedesignQuestRequest) => Promise<boolean>
  onRefresh: () => void
  onClearError: () => void
}

export function QuestRedesignDialog({
  quest,
  isSubmitting,
  error,
  onClose,
  onSubmit,
  onRefresh,
  onClearError,
}: QuestRedesignDialogProps) {
  const firstReasonRef = useRef<HTMLInputElement>(null)
  const [reasonCode, setReasonCode] = useState<QuestFailureReasonCode | ''>('')
  const [reasonNote, setReasonNote] = useState('')
  const [validationErrors, setValidationErrors] =
    useState<RedesignFormErrors>({})

  useEffect(() => firstReasonRef.current?.focus(), [])

  function close() {
    if (!isSubmitting) onClose()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !isSubmitting) {
      event.preventDefault()
      onClose()
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = { reasonCode, reasonNote }
    const nextErrors = validateRedesignForm(values)
    setValidationErrors(nextErrors)
    const input = toRedesignQuestRequest(values)
    if (!input) return

    if (await onSubmit(input)) onClose()
  }

  function selectReason(nextReasonCode: QuestFailureReasonCode) {
    setReasonCode(nextReasonCode)
    setValidationErrors((current) => ({ ...current, reasonCode: undefined }))
    onClearError()
  }

  return (
    <div
      className="quest-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) close()
      }}
    >
      <div
        className="quest-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`redesign-${quest.id}-title`}
        aria-describedby={`redesign-${quest.id}-description`}
        aria-busy={isSubmitting}
        onKeyDown={handleKeyDown}
      >
        <div className="quest-dialog-heading">
          <div>
            <p className="eyebrow">더 작게 바꾸기</p>
            <h2 id={`redesign-${quest.id}-title`}>
              어떤 부분을 더 가볍게 만들까요?
            </h2>
          </div>
          <button
            className="dialog-close"
            type="button"
            aria-label="더 작게 바꾸기 닫기"
            onClick={close}
            disabled={isSubmitting}
          >
            ×
          </button>
        </div>
        <p id={`redesign-${quest.id}-description`} className="quest-dialog-copy">
          이유는 다음 행동의 범위를 줄이는 데 사용해요. 입력한 내용은 이 창을
          닫기 전까지 유지돼요.
        </p>

        {error && (
          <div className="alert alert-error outcome-error" role="alert">
            <span aria-hidden="true">!</span>
            <div>
              <strong>{error.title}</strong>
              <p>{error.message}</p>
              {error.action === 'refresh' && (
                <button
                  className="text-retry"
                  type="button"
                  onClick={() => {
                    onRefresh()
                    onClose()
                  }}
                >
                  오늘 목록 다시 확인
                </button>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <fieldset
            className="reason-fieldset"
            aria-describedby={validationErrors.reasonCode ? 'reason-code-error' : undefined}
          >
            <legend>오늘 어려웠던 이유</legend>
            <div className="reason-options">
              {QUEST_FAILURE_REASONS.map((code, index) => (
                <label key={code}>
                  <input
                    ref={index === 0 ? firstReasonRef : undefined}
                    type="radio"
                    name="reasonCode"
                    value={code}
                    checked={reasonCode === code}
                    onChange={() => selectReason(code)}
                    disabled={isSubmitting}
                  />
                  <span>{QUEST_FAILURE_REASON_LABELS[code]}</span>
                </label>
              ))}
            </div>
            {validationErrors.reasonCode && (
              <p className="field-error" id="reason-code-error" role="alert">
                {validationErrors.reasonCode}
              </p>
            )}
          </fieldset>

          <div className="reason-note-field">
            <div className="label-row">
              <label htmlFor={`reason-note-${quest.id}`}>선택 메모</label>
              <span>{reasonNote.length}/{QUEST_REASON_NOTE_MAX_LENGTH}</span>
            </div>
            <textarea
              id={`reason-note-${quest.id}`}
              value={reasonNote}
              maxLength={QUEST_REASON_NOTE_MAX_LENGTH}
              rows={4}
              placeholder="조금 더 알려주고 싶다면 적어 주세요. (선택)"
              aria-invalid={Boolean(validationErrors.reasonNote)}
              aria-describedby={
                validationErrors.reasonNote
                  ? `reason-note-${quest.id}-error`
                  : undefined
              }
              onChange={(event) => {
                setReasonNote(event.target.value)
                setValidationErrors((current) => ({
                  ...current,
                  reasonNote: undefined,
                }))
                onClearError()
              }}
              disabled={isSubmitting}
            />
            {validationErrors.reasonNote && (
              <p
                className="field-error"
                id={`reason-note-${quest.id}-error`}
                role="alert"
              >
                {validationErrors.reasonNote}
              </p>
            )}
          </div>

          <div className="quest-dialog-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={close}
              disabled={isSubmitting}
            >
              그대로 둘게요
            </button>
            <button
              className="button button-primary"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting && <span className="spinner" aria-hidden="true" />}
              {isSubmitting
                ? '더 작은 행동 준비 중'
                : error?.action === 'retry'
                  ? '같은 내용으로 다시 시도'
                  : '이 퀘스트 더 작게 바꾸기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
