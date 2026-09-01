import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppRoutes } from './App'
import {
  QuestApiError,
  QuestNetworkError,
  type QuestApi,
  type SessionStartResult,
} from './api/client'
import type { JourneySnapshot } from './api/contracts'
import { JourneyStore } from './state/journeyStore'

const COMMAND_ID = '00000000-0000-4000-8000-000000000099'

const baseSnapshot: JourneySnapshot = {
  journeyId: '00000000-0000-4000-8000-000000000001',
  goalType: 'JOB_SEARCH',
  energyLevel: 'LOW',
  availableMinutes: 5,
  version: 1,
  currentQuest: {
    id: '00000000-0000-4000-8000-000000000002',
    catalogKey: 'job-search-open-tab-v1',
    title: '채용 사이트 탭 열기',
    instruction: '사이트를 열면 오늘 행동은 끝입니다.',
    estimatedMinutes: 2,
    difficultyLevel: 1,
  },
  progress: { completedCount: 0, reframedCount: 0 },
  recentAttempts: [],
}

const nextSnapshot: JourneySnapshot = {
  ...baseSnapshot,
  version: 2,
  currentQuest: {
    ...baseSnapshot.currentQuest,
    id: '00000000-0000-4000-8000-000000000003',
    title: '검색어 1개 적기',
  },
  progress: { completedCount: 1, reframedCount: 0 },
  recentAttempts: [
    {
      id: '00000000-0000-4000-8000-000000000004',
      catalogKey: baseSnapshot.currentQuest.catalogKey,
      title: baseSnapshot.currentQuest.title,
      status: 'COMPLETED',
      frictionReason: null,
      transitionedAt: '2026-09-01T01:00:00.000Z',
    },
  ],
}

function apiStub(overrides: Partial<QuestApi> = {}): QuestApi {
  return {
    startSession: vi.fn().mockResolvedValue({
      created: true,
      expiresAt: '2026-10-01T00:00:00.000Z',
    }),
    getJourney: vi.fn().mockResolvedValue(baseSnapshot),
    createJourney: vi.fn().mockResolvedValue(baseSnapshot),
    completeQuest: vi.fn().mockResolvedValue({
      transition: {
        type: 'COMPLETED',
        previousAttemptId: baseSnapshot.currentQuest.id,
        reason: null,
      },
      snapshot: nextSnapshot,
    }),
    reframeQuest: vi.fn().mockResolvedValue({
      transition: {
        type: 'REFRAMED',
        previousAttemptId: baseSnapshot.currentQuest.id,
        reason: 'TOO_BIG',
      },
      snapshot: {
        ...nextSnapshot,
        progress: { completedCount: 0, reframedCount: 1 },
      },
    }),
    ...overrides,
  }
}

function existingJourneyApi(overrides: Partial<QuestApi> = {}) {
  return apiStub({
    startSession: vi.fn().mockResolvedValue({
      created: false,
      expiresAt: '2026-10-01T00:00:00.000Z',
    }),
    ...overrides,
  })
}

function renderRoute(path: string, api: QuestApi) {
  const store = new JourneyStore(api, () => COMMAND_ID)
  return {
    store,
    ...render(
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes store={store} />
      </MemoryRouter>,
    ),
  }
}

describe('핵심 사용자 화면 흐름', () => {
  it('bootstrap loading을 polite live region으로 알린다', async () => {
    let resolveSession!: (value: SessionStartResult) => void
    const startSession = vi.fn(() => new Promise<SessionStartResult>((resolve) => {
      resolveSession = resolve
    }))

    renderRoute('/', apiStub({ startSession }))

    const loading = screen.getByRole('status')
    expect(loading).toHaveAttribute('aria-live', 'polite')
    expect(loading).toHaveTextContent('여정 확인 중')

    await act(async () => resolveSession({
      created: true,
      expiresAt: '2026-10-01T00:00:00.000Z',
    }))
    expect(await screen.findByRole('heading', { name: /멈춘 준비를/ })).toBeVisible()
  })

  it.each([
    ['/', apiStub(), /멈춘 준비를/],
    ['/quest', apiStub(), /오늘 가능한 만큼/],
    ['/', existingJourneyApi(), /한 번에 한 가지만/],
    ['/start', existingJourneyApi(), /한 번에 한 가지만/],
    ['/quest', existingJourneyApi(), /한 번에 한 가지만/],
  ])('%s 직접 진입에서 여정 유무에 맞는 화면으로 이동한다', async (path, api, heading) => {
    renderRoute(path, api)
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeVisible()
  })

  it('랜딩은 시작 CTA 하나를 명확히 제공하고 설정은 세 값만 요구한다', async () => {
    const user = userEvent.setup()
    const createJourney = vi.fn().mockResolvedValue(baseSnapshot)
    renderRoute('/', apiStub({ createJourney }))

    const startButton = await screen.findByRole('button', { name: '오늘의 작은 행동 만들기' })
    expect(screen.getAllByRole('button')).toHaveLength(1)
    startButton.focus()
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('heading', { name: /오늘 가능한 만큼/ })).toBeVisible()
    expect(screen.getAllByRole('group')).toHaveLength(3)

    const submitButton = screen.getByRole('button', { name: '작은 행동 확인하기' })
    await user.click(submitButton)
    expect(screen.getByRole('alert')).toHaveTextContent('목표, 에너지, 가능한 시간을')

    for (const radio of [
      screen.getByRole('radio', { name: /구직 활동/ }),
      screen.getByRole('radio', { name: /낮아요/ }),
      screen.getByRole('radio', { name: '5분' }),
    ]) {
      radio.focus()
      await user.keyboard(' ')
    }
    submitButton.focus()
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('heading', { name: baseSnapshot.currentQuest.title })).toBeVisible()
    expect(createJourney).toHaveBeenCalledWith(
      { goalType: 'JOB_SEARCH', energyLevel: 'LOW', availableMinutes: 5 },
      COMMAND_ID,
    )
  })

  it('quest의 현재 행동, 두 action, 진행 수치, empty 기록을 우선순위대로 표시한다', async () => {
    renderRoute('/quest', existingJourneyApi())

    const currentQuest = await screen.findByRole('heading', { name: baseSnapshot.currentQuest.title })
    const complete = screen.getByRole('button', { name: '완료했어요' })
    expect(currentQuest.compareDocumentPosition(complete) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText(baseSnapshot.currentQuest.instruction)).toBeVisible()
    expect(screen.getByRole('button', { name: '지금은 어려워요' })).toBeVisible()
    expect(screen.getByText('완료한 행동').nextSibling).toHaveTextContent('0')
    expect(screen.getByText('더 쉽게 바꾼 행동').nextSibling).toHaveTextContent('0')

    const empty = screen.getByRole('status')
    expect(empty).toHaveAttribute('aria-live', 'polite')
    expect(empty).toHaveTextContent('아직 기록이 없어요')
  })

  it('완료 action은 다음 행동과 aria-live feedback을 갱신한다', async () => {
    const user = userEvent.setup()
    renderRoute('/quest', existingJourneyApi())

    const complete = await screen.findByRole('button', { name: '완료했어요' })
    complete.focus()
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('heading', { name: nextSnapshot.currentQuest.title })).toBeVisible()
    const feedback = screen.getByRole('status')
    expect(feedback).toHaveAttribute('aria-live', 'polite')
    expect(feedback).toHaveTextContent('작은 행동을 완료했어요')
  })

  it('재설계 sheet는 다섯 이유 중 하나를 키보드로 선택해 더 쉬운 행동을 받는다', async () => {
    const user = userEvent.setup()
    const reframeQuest = vi.fn().mockResolvedValue({
      transition: {
        type: 'REFRAMED',
        previousAttemptId: baseSnapshot.currentQuest.id,
        reason: 'TOO_BIG',
      },
      snapshot: {
        ...nextSnapshot,
        progress: { completedCount: 0, reframedCount: 1 },
      },
    })
    renderRoute('/quest', existingJourneyApi({ reframeQuest }))

    const difficult = await screen.findByRole('button', { name: '지금은 어려워요' })
    difficult.focus()
    await user.keyboard('{Enter}')

    const dialog = screen.getByRole('dialog', { name: '어떤 점이 지금 어렵나요?' })
    const reasons = within(dialog).getAllByRole('radio')
    expect(reasons).toHaveLength(5)
    expect(reasons[0]).toHaveFocus()
    await user.keyboard(' ')
    const submit = within(dialog).getByRole('button', { name: '더 쉬운 행동 받기' })
    submit.focus()
    await user.keyboard('{Enter}')

    expect(await screen.findByText('더 쉬운 행동을 준비했어요')).toBeVisible()
    expect(reframeQuest).toHaveBeenCalledWith(
      baseSnapshot.currentQuest.id,
      'TOO_BIG',
      COMMAND_ID,
      baseSnapshot.version,
    )
    expect(difficult).toHaveFocus()
    expect(screen.queryByText(/실패|의지/)).not.toBeInTheDocument()
  })

  it('network 오류는 같은 commandId로 재시도하고 성공 feedback으로 복구한다', async () => {
    const user = userEvent.setup()
    const completeQuest = vi.fn()
      .mockRejectedValueOnce(new QuestNetworkError('network'))
      .mockResolvedValueOnce({
        transition: {
          type: 'COMPLETED',
          previousAttemptId: baseSnapshot.currentQuest.id,
          reason: null,
        },
        snapshot: nextSnapshot,
      })
    renderRoute('/quest', existingJourneyApi({ completeQuest }))

    await user.click(await screen.findByRole('button', { name: '완료했어요' }))
    const retryAlert = await screen.findByRole('alert')
    expect(retryAlert).toHaveAttribute('aria-live', 'assertive')
    await user.click(within(retryAlert).getByRole('button', { name: '같은 요청 다시 시도' }))

    expect(await screen.findByText('작은 행동을 완료했어요')).toBeVisible()
    expect(completeQuest).toHaveBeenCalledTimes(2)
    expect(completeQuest.mock.calls[0][1]).toBe(COMMAND_ID)
    expect(completeQuest.mock.calls[1][1]).toBe(COMMAND_ID)
  })

  it('bootstrap network 오류는 live alert와 재시도 action을 제공한다', async () => {
    const user = userEvent.setup()
    const startSession = vi.fn()
      .mockRejectedValueOnce(new QuestNetworkError('network'))
      .mockResolvedValueOnce({ created: true, expiresAt: '2026-10-01T00:00:00.000Z' })
    renderRoute('/', apiStub({ startSession }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveAttribute('aria-live', 'assertive')
    await user.click(within(alert).getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByRole('heading', { name: /멈춘 준비를/ })).toBeVisible()
  })

  it('stale 응답은 최신 snapshot과 polite feedback을 표시한다', async () => {
    const user = userEvent.setup()
    const staleSnapshot = {
      ...nextSnapshot,
      currentQuest: { ...nextSnapshot.currentQuest, title: '최신 행동 확인하기' },
    }
    const completeQuest = vi.fn().mockRejectedValue(new QuestApiError(409, {
      code: 'STALE_JOURNEY',
      message: '요청 버전이 오래되었습니다.',
      snapshot: staleSnapshot,
    }))
    renderRoute('/quest', existingJourneyApi({ completeQuest }))

    await user.click(await screen.findByRole('button', { name: '완료했어요' }))

    expect(await screen.findByRole('heading', { name: staleSnapshot.currentQuest.title })).toBeVisible()
    const feedback = screen.getByRole('status')
    expect(feedback).toHaveAttribute('aria-live', 'polite')
    expect(feedback).toHaveTextContent('다른 요청이 먼저 반영되어 최신 상태를 불러왔어요.')
  })

  it('session 만료는 새 익명 세션을 준비하고 설정 화면에서 이유를 알린다', async () => {
    const user = userEvent.setup()
    const startSession = vi.fn()
      .mockResolvedValueOnce({ created: false, expiresAt: '2026-10-01T00:00:00.000Z' })
      .mockResolvedValueOnce({ created: true, expiresAt: '2026-10-01T00:00:00.000Z' })
    const completeQuest = vi.fn().mockRejectedValue(new QuestApiError(401, {
      code: 'SESSION_REQUIRED',
      message: '세션이 필요합니다.',
    }))
    renderRoute('/quest', existingJourneyApi({ startSession, completeQuest }))

    await user.click(await screen.findByRole('button', { name: '완료했어요' }))

    expect(await screen.findByRole('heading', { name: /오늘 가능한 만큼/ })).toBeVisible()
    const feedback = screen.getByRole('status')
    expect(feedback).toHaveAttribute('aria-live', 'polite')
    expect(feedback).toHaveTextContent('세션이 만료되어 새로 시작합니다.')
    await waitFor(() => expect(startSession).toHaveBeenCalledTimes(2))
  })
})
