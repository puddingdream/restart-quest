import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import type { FrictionReason, JourneySnapshot } from '../../api/contracts'
import { AppShell } from '../../components/AppShell'
import { Button } from '../../components/Button'
import { Feedback } from '../../components/Feedback'
import type { JourneyStore } from '../../state/journeyStore'
import { JourneyFeedback } from './JourneyFeedback'
import { frictionOptions } from './journeyOptions'

const statusLabels = {
  ACTIVE: '진행 중',
  COMPLETED: '완료',
  REFRAMED: '더 쉽게 바꿈',
} as const

function ReframeSheet({ onClose, store }: { onClose: () => void; store: JourneyStore }) {
  const [reason, setReason] = useState<FrictionReason>()
  const dialogRef = useRef<HTMLDivElement>(null)
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState)
  const isReframing = state.mutation.status === 'pending'
    && state.mutation.command.kind === 'reframe'

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!reason) return
    await store.reframeCurrentQuest(reason)
    onClose()
  }

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && !isReframing) {
      onClose()
      return
    }

    if (event.key !== 'Tab' || !dialogRef.current) return

    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled)',
    ))
    const first = focusable.at(0)
    const last = focusable.at(-1)

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  return (
    <div className="sheet-backdrop">
      <div
        aria-describedby="reframe-description"
        aria-labelledby="reframe-title"
        aria-modal="true"
        className="reframe-sheet"
        onKeyDown={handleDialogKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        <div className="sheet-heading">
          <div>
            <p className="eyebrow">행동 다시 맞추기</p>
            <h2 id="reframe-title">어떤 점이 지금 어렵나요?</h2>
          </div>
          <button className="sheet-close" disabled={isReframing} onClick={onClose} type="button">
            닫기
          </button>
        </div>
        <p className="sheet-description" id="reframe-description">
          이유 하나를 고르면 지금보다 가벼운 행동을 연결해 드려요.
        </p>
        <form onSubmit={handleSubmit}>
          <fieldset className="choice-group">
            <legend className="visually-hidden">지금 어려운 이유</legend>
            <div className="choice-list">
              {frictionOptions.map((option, index) => (
                <label className="choice-card" key={option.value}>
                  <input
                    autoFocus={index === 0}
                    checked={reason === option.value}
                    name="frictionReason"
                    onChange={() => setReason(option.value)}
                    type="radio"
                    value={option.value}
                  />
                  <span><strong>{option.label}</strong></span>
                </label>
              ))}
            </div>
          </fieldset>
          <Button
            disabled={!reason}
            isLoading={isReframing}
            loadingLabel="더 쉬운 행동 찾는 중…"
            type="submit"
          >
            더 쉬운 행동 받기
          </Button>
        </form>
      </div>
    </div>
  )
}

function RecentAttempts({ snapshot }: { snapshot: JourneySnapshot }) {
  if (snapshot.recentAttempts.length === 0) {
    return (
      <Feedback title="아직 기록이 없어요">
        <p>첫 행동을 마치거나 더 쉽게 바꾸면 여기에 최근 기록이 남아요.</p>
      </Feedback>
    )
  }

  return (
    <ol className="attempt-list">
      {snapshot.recentAttempts.map((attempt) => (
        <li key={attempt.id}>
          <div>
            <strong>{attempt.title}</strong>
            <span>{statusLabels[attempt.status]}</span>
          </div>
          <time dateTime={attempt.transitionedAt}>
            {new Intl.DateTimeFormat('ko-KR', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date(attempt.transitionedAt))}
          </time>
        </li>
      ))}
    </ol>
  )
}

export function QuestPage({ store }: { store: JourneyStore }) {
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState)
  const snapshot = state.snapshot
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [reframeTrigger, setReframeTrigger] = useState<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!isSheetOpen) reframeTrigger?.focus()
  }, [isSheetOpen, reframeTrigger])

  if (!snapshot) return null

  const isCompleting = state.mutation.status === 'pending'
    && state.mutation.command.kind === 'complete'

  return (
    <AppShell>
      <section className="quest-page" aria-labelledby="quest-title">
        <div className="journey-heading">
          <p className="eyebrow">오늘의 작은 행동</p>
          <h1 id="quest-title">한 번에 한 가지만 이어가요</h1>
        </div>

        <JourneyFeedback mutation={state.mutation} onRetry={() => void store.retryMutation()} />

        <article className="quest-card" aria-labelledby="current-quest-title">
          <div className="quest-card__meta">
            <span>지금 할 행동</span>
            <span>약 {snapshot.currentQuest.estimatedMinutes}분</span>
          </div>
          <h2 id="current-quest-title">{snapshot.currentQuest.title}</h2>
          <p>{snapshot.currentQuest.instruction}</p>
          <div className="quest-actions">
            <Button
              isLoading={isCompleting}
              loadingLabel="완료 기록하는 중…"
              onClick={() => void store.completeCurrentQuest()}
            >
              완료했어요
            </Button>
            <Button
              variant="secondary"
              onClick={(event) => {
                setReframeTrigger(event.currentTarget)
                setIsSheetOpen(true)
              }}
            >
              지금은 어려워요
            </Button>
          </div>
        </article>

        <section className="progress-section" aria-labelledby="progress-title">
          <div className="section-heading">
            <p className="eyebrow">진행 수치</p>
            <h2 id="progress-title">오늘까지 이어 온 변화</h2>
          </div>
          <dl className="progress-grid">
            <div><dt>완료한 행동</dt><dd>{snapshot.progress.completedCount}</dd></div>
            <div><dt>더 쉽게 바꾼 행동</dt><dd>{snapshot.progress.reframedCount}</dd></div>
          </dl>
        </section>

        <section className="history-section" aria-labelledby="history-title">
          <div className="section-heading">
            <p className="eyebrow">최근 기록</p>
            <h2 id="history-title">최근 5개 행동</h2>
          </div>
          <RecentAttempts snapshot={snapshot} />
        </section>
      </section>

      {isSheetOpen && <ReframeSheet onClose={() => setIsSheetOpen(false)} store={store} />}
    </AppShell>
  )
}
