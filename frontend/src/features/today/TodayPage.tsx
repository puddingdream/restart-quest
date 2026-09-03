import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { Button } from '../../components/Button'
import { LoadingIndicator } from '../../components/LoadingIndicator'
import { StatusNotice } from '../../components/StatusNotice'
import { ApiError } from '../../lib/api/ApiClient'
import {
  queryClient as defaultQueryClient,
  type QueryClient,
} from '../../lib/query/QueryClient'
import { RouteLink } from './RouteLink'
import {
  availableMinutes,
  barriers,
  energyLevels,
  focusAreas,
  type AvailableMinutes,
  type Barrier,
  type CheckInInput,
  type EnergyLevel,
  type FocusArea,
  type Quest,
  type TodayView,
} from './contracts'
import { questApi as defaultQuestApi, type QuestApi } from './questApi'

const energyLabels: Record<EnergyLevel, string> = {
  LOW: '낮아요',
  MEDIUM: '보통이에요',
  HIGH: '충분해요',
}

const focusLabels: Record<FocusArea, string> = {
  EXPLORE: '직무 탐색',
  RESUME: '이력서',
  APPLY: '지원 준비',
  INTERVIEW: '면접 연습',
}

const barrierLabels: Record<Barrier, string> = {
  TOO_LARGE: '행동이 너무 크게 느껴져요',
  NO_TIME: '시간이 부족해요',
  LOW_ENERGY: '에너지가 부족해요',
  UNCLEAR: '어떻게 할지 모르겠어요',
  EMOTIONAL_LOAD: '마음의 부담이 커요',
  OTHER: '다른 이유가 있어요',
}

function messageFor(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : '요청을 처리하지 못했습니다. 다시 시도해 주세요.'
}

type ChoiceGroupProps<T extends string | number> = {
  label: string
  name: string
  onChange(value: T): void
  options: readonly T[]
  renderLabel(value: T): string
  value: T | null
}

function ChoiceGroup<T extends string | number>({
  label,
  name,
  onChange,
  options,
  renderLabel,
  value,
}: ChoiceGroupProps<T>) {
  return (
    <fieldset className="choice-group">
      <legend>{label}</legend>
      <div className="choice-grid">
        {options.map((option) => {
          const id = `${name}-${option}`.toLowerCase()
          return (
            <label className="choice-card" htmlFor={id} key={option}>
              <input
                checked={value === option}
                id={id}
                name={name}
                onChange={() => onChange(option)}
                type="radio"
                value={option}
              />
              <span>{renderLabel(option)}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function CheckInForm({
  isSubmitting,
  onSubmit,
}: {
  isSubmitting: boolean
  onSubmit(input: CheckInInput): Promise<void>
}) {
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel | null>(null)
  const [minutes, setMinutes] = useState<AvailableMinutes | null>(null)
  const [focusArea, setFocusArea] = useState<FocusArea | null>(null)
  const isComplete = energyLevel !== null && minutes !== null && focusArea !== null

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isComplete || isSubmitting) {
      return
    }

    void onSubmit({ availableMinutes: minutes, energyLevel, focusArea })
  }

  return (
    <form className="check-in-form" aria-label="오늘 체크인" onSubmit={handleSubmit}>
      <ChoiceGroup<EnergyLevel>
        label="지금 에너지는 어떤가요?"
        name="energy"
        onChange={setEnergyLevel}
        options={energyLevels}
        renderLabel={(value) => energyLabels[value]}
        value={energyLevel}
      />
      <ChoiceGroup<AvailableMinutes>
        label="오늘 몇 분을 쓸 수 있나요?"
        name="minutes"
        onChange={setMinutes}
        options={availableMinutes}
        renderLabel={(value) => `${value}분`}
        value={minutes}
      />
      <ChoiceGroup<FocusArea>
        label="어디에 집중할까요?"
        name="focus"
        onChange={setFocusArea}
        options={focusAreas}
        renderLabel={(value) => focusLabels[value]}
        value={focusArea}
      />
      <Button
        type="submit"
        disabled={!isComplete}
        isLoading={isSubmitting}
        loadingLabel="행동 고르는 중"
      >
        오늘의 작은 행동 받기
      </Button>
      {!isComplete ? (
        <p className="form-guidance">세 가지를 모두 선택하면 오늘의 행동을 받을 수 있어요.</p>
      ) : null}
    </form>
  )
}

function improvementSummary(previous: Quest, next: Quest): string {
  const improvements: string[] = []
  const minuteDifference = previous.estimatedMinutes - next.estimatedMinutes
  const difficultyDifference = previous.difficulty - next.difficulty

  if (minuteDifference > 0) {
    improvements.push(`${minuteDifference}분 짧아졌어요`)
  }
  if (difficultyDifference > 0) {
    improvements.push(`난이도가 ${difficultyDifference}단계 쉬워졌어요`)
  }

  return improvements.join(' · ') || '같은 부담을 더 작은 단계로 나눴어요'
}

type ActiveQuestProps = {
  isSubmitting: boolean
  onBlock(input: { barrier: Barrier; note?: string }): Promise<void>
  onComplete(): Promise<void>
  quest: Quest
  transition: { next: Quest; previous: Quest } | null
}

function ActiveQuest({
  isSubmitting,
  onBlock,
  onComplete,
  quest,
  transition,
}: ActiveQuestProps) {
  const [isBlockFormOpen, setIsBlockFormOpen] = useState(false)
  const [barrier, setBarrier] = useState<Barrier | null>(null)
  const [note, setNote] = useState('')

  const submitBlock = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!barrier || isSubmitting) {
      return
    }

    void onBlock({ barrier, note: note.trim() || undefined })
  }

  return (
    <>
      {transition && transition.next.id === quest.id ? (
        <section className="transition-card" aria-labelledby="transition-title">
          <p className="eyebrow">더 작게 다시 시작해요</p>
          <h2 id="transition-title">이전 행동에서 부담을 줄였어요</h2>
          <p className="transition-card__previous">이전 행동: {transition.previous.title}</p>
          <p className="transition-card__change">
            더 쉬워진 점: {improvementSummary(transition.previous, transition.next)}
          </p>
        </section>
      ) : null}

      <article className="quest-card" aria-labelledby="quest-title">
        <p className="eyebrow">오늘은 이것 하나만</p>
        <h1 id="quest-title">{quest.title}</h1>
        <dl className="quest-meta">
          <div>
            <dt>예상 시간</dt>
            <dd>{quest.estimatedMinutes}분</dd>
          </div>
          <div>
            <dt>난이도</dt>
            <dd>{quest.difficulty}단계</dd>
          </div>
        </dl>
        <p className="quest-reason">{quest.reason}</p>
        <div className="quest-actions">
          <Button
            type="button"
            isLoading={isSubmitting}
            loadingLabel="기록 중"
            onClick={() => void onComplete()}
          >
            완료했어요
          </Button>
          {quest.difficulty > 0 ? (
            <Button
              type="button"
              variant="secondary"
              disabled={isSubmitting}
              aria-expanded={isBlockFormOpen}
              aria-controls="block-form"
              onClick={() => setIsBlockFormOpen((open) => !open)}
            >
              지금은 막혔어요
            </Button>
          ) : null}
        </div>
      </article>

      {isBlockFormOpen && quest.difficulty > 0 ? (
        <form className="block-form" id="block-form" aria-label="막힌 이유" onSubmit={submitBlock}>
          <div>
            <p className="eyebrow">잘못한 게 아니에요</p>
            <h2>어디에서 막혔나요?</h2>
            <p>이유를 고르면 바로 더 짧거나 쉬운 행동으로 바꿔 드려요.</p>
          </div>
          <ChoiceGroup<Barrier>
            label="막힌 이유"
            name="barrier"
            onChange={setBarrier}
            options={barriers}
            renderLabel={(value) => barrierLabels[value]}
            value={barrier}
          />
          <div className="form-field">
            <label className="form-field__label" htmlFor="barrier-note">
              메모 (선택)
            </label>
            <p className="form-field__hint" id="barrier-note-hint">
              나만 볼 수 있으며 300자까지 적을 수 있어요.
            </p>
            <textarea
              aria-describedby="barrier-note-hint"
              className="form-field__input block-form__note"
              id="barrier-note"
              maxLength={300}
              onChange={(event) => setNote(event.target.value)}
              value={note}
            />
          </div>
          <Button
            type="submit"
            disabled={!barrier}
            isLoading={isSubmitting}
            loadingLabel="더 작은 행동 찾는 중"
          >
            더 작은 행동으로 바꾸기
          </Button>
        </form>
      ) : null}
    </>
  )
}

export function TodayPage({
  accountId = 'current',
  api = defaultQuestApi,
  queryClient = defaultQueryClient,
}: {
  accountId?: string
  api?: QuestApi
  queryClient?: QueryClient
}) {
  const todayQueryKey = `quest.today:${accountId}`
  const [view, setView] = useState<TodayView | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<'block' | 'check-in' | 'complete' | null>(null)
  const [transition, setTransition] = useState<{ next: Quest; previous: Quest } | null>(null)
  const mutationLock = useRef(false)

  const loadToday = useCallback(
    async (force = false) => {
      setLoadError(null)
      if (force) {
        queryClient.invalidate(todayQueryKey)
      }

      try {
        const nextView = await queryClient.fetchQuery(todayQueryKey, () => api.today())
        setView(nextView)
        return nextView
      } catch (error) {
        setLoadError(messageFor(error))
        throw error
      }
    },
    [api, queryClient, todayQueryKey],
  )

  useEffect(() => {
    queueMicrotask(() => void loadToday().catch(() => undefined))
  }, [loadToday])

  const synchronizeStaleQuest = async () => {
    setTransition(null)
    const synchronized = await loadToday(true)
    setSyncMessage('다른 요청으로 오늘 상태가 바뀌어 최신 내용으로 다시 불러왔어요.')
    return synchronized
  }

  const runMutation = async (
    action: 'block' | 'check-in' | 'complete',
    request: () => Promise<TodayView>,
    previousQuest?: Quest,
  ) => {
    if (mutationLock.current) {
      return
    }

    mutationLock.current = true
    setPendingAction(action)
    setMutationError(null)
    setSyncMessage(null)

    try {
      const nextView = await request()
      queryClient.setQueryData(todayQueryKey, nextView)
      setView(nextView)
      if (action === 'block' && previousQuest && nextView.activeQuest) {
        setTransition({ next: nextView.activeQuest, previous: previousQuest })
      } else {
        setTransition(null)
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === 'STALE_QUEST') {
        try {
          await synchronizeStaleQuest()
        } catch (refreshError) {
          setMutationError(messageFor(refreshError))
        }
      } else {
        setMutationError(messageFor(error))
      }
    } finally {
      mutationLock.current = false
      setPendingAction(null)
    }
  }

  if (!view && !loadError) {
    return (
      <section className="quest-page" aria-label="오늘">
        <LoadingIndicator label="오늘의 상태를 불러오는 중" />
      </section>
    )
  }

  if (!view && loadError) {
    return (
      <section className="quest-page" aria-label="오늘 불러오기 오류">
        <StatusNotice
          tone="error"
          title="오늘의 상태를 불러오지 못했어요"
          description={loadError}
        />
        <Button type="button" onClick={() => void loadToday(true).catch(() => undefined)}>
          오늘 다시 불러오기
        </Button>
      </section>
    )
  }

  if (!view) {
    return null
  }

  return (
    <section className="quest-page" aria-label="오늘">
      {mutationError ? (
        <StatusNotice
          tone="error"
          title="요청을 마치지 못했어요"
          description={mutationError}
        />
      ) : null}
      {syncMessage ? (
        <StatusNotice title="최신 상태로 맞췄어요" description={syncMessage} />
      ) : null}

      {view.phase === 'CHECK_IN_REQUIRED' ? (
        <>
          <header className="page-heading">
            <p className="eyebrow">오늘의 체크인</p>
            <h1 id="today-title">지금 가능한 만큼만 골라요</h1>
            <p>정답은 없어요. 선택한 세 가지로 오늘 끝낼 수 있는 행동을 찾습니다.</p>
          </header>
          <CheckInForm
            isSubmitting={pendingAction === 'check-in'}
            onSubmit={(input) => runMutation('check-in', () => api.checkIn(input))}
          />
        </>
      ) : null}

      {view.phase === 'QUEST_ACTIVE' && view.activeQuest ? (
        <ActiveQuest
          isSubmitting={pendingAction !== null}
          quest={view.activeQuest}
          transition={transition}
          onComplete={() =>
            runMutation('complete', () => api.complete(view.activeQuest!.id, view.activeQuest!.version))
          }
          onBlock={(input) =>
            runMutation(
              'block',
              () =>
                api.block(view.activeQuest!.id, {
                  ...input,
                  version: view.activeQuest!.version,
                }),
              view.activeQuest!,
            )
          }
        />
      ) : null}

      {view.phase === 'DAY_COMPLETED' ? (
        <div className="completion-card">
          <p className="eyebrow">오늘의 한 걸음 완료</p>
          <h1 id="today-title">오늘은 여기까지면 충분해요</h1>
          <p>{view.completedQuest?.title}을 기록했어요. 같은 날 새 행동을 더하지 않아도 괜찮아요.</p>
          <RouteLink className="button button--primary" to="/history">
            최근 기록 보기
          </RouteLink>
        </div>
      ) : null}
    </section>
  )
}
