import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../lib/api/ApiClient'
import { QueryClient } from '../../lib/query/QueryClient'
import type { Quest, TodayView } from './contracts'
import type { QuestApi } from './questApi'
import { TodayPage } from './TodayPage'

const quest: Quest = {
  difficulty: 2,
  estimatedMinutes: 15,
  id: 'quest-1',
  predecessorQuestId: null,
  reason: '지금의 시간과 에너지에 맞췄어요.',
  title: '경력 한 줄의 동사와 결과 다듬기',
  version: 3,
}

const smallerQuest: Quest = {
  difficulty: 0,
  estimatedMinutes: 2,
  id: 'quest-2',
  predecessorQuestId: quest.id,
  reason: '부담을 줄여 2분 행동으로 바꿨어요.',
  title: '내일 다시 볼 이력서 한 문장 남기기',
  version: 0,
}

const checkIn = {
  availableMinutes: 15 as const,
  energyLevel: 'MEDIUM' as const,
  focusArea: 'RESUME' as const,
}

const checkInRequired: TodayView = {
  activeQuest: null,
  checkIn: null,
  completedQuest: null,
  date: '2026-09-03',
  phase: 'CHECK_IN_REQUIRED',
}

const active: TodayView = {
  activeQuest: quest,
  checkIn,
  completedQuest: null,
  date: '2026-09-03',
  phase: 'QUEST_ACTIVE',
}

const smallerActive: TodayView = {
  activeQuest: smallerQuest,
  checkIn,
  completedQuest: null,
  date: '2026-09-03',
  phase: 'QUEST_ACTIVE',
}

const completed: TodayView = {
  activeQuest: null,
  checkIn,
  completedQuest: quest,
  date: '2026-09-03',
  phase: 'DAY_COMPLETED',
}

function createApi(todayView: TodayView = active): QuestApi {
  return {
    block: vi.fn(async () => smallerActive),
    checkIn: vi.fn(async () => active),
    complete: vi.fn(async () => completed),
    today: vi.fn(async () => todayView),
  }
}

function renderToday(api: QuestApi) {
  return render(<TodayPage api={api} queryClient={new QueryClient()} />)
}

afterEach(() => {
  cleanup()
})

describe('TodayPage', () => {
  it('starts every check-in group empty and submits only after all three choices', async () => {
    const api = createApi(checkInRequired)
    renderToday(api)

    expect(await screen.findByRole('heading', { name: '지금 가능한 만큼만 골라요' })).toBeVisible()
    const submit = screen.getByRole('button', { name: '오늘의 작은 행동 받기' })
    expect(submit).toBeDisabled()
    expect(screen.getAllByRole('radio').every((radio) => !radio.hasAttribute('checked'))).toBe(true)

    fireEvent.click(screen.getByLabelText('보통이에요'))
    fireEvent.click(screen.getByLabelText('15분'))
    expect(submit).toBeDisabled()
    fireEvent.click(screen.getByLabelText('이력서'))
    expect(submit).toBeEnabled()
    fireEvent.click(submit)

    expect(await screen.findByRole('heading', { name: quest.title })).toBeVisible()
    expect(api.checkIn).toHaveBeenCalledWith(checkIn)
  })

  it('uses phase to render an active quest even when server copy sounds complete', async () => {
    const copyIsNotState = {
      ...active,
      activeQuest: { ...quest, title: '오늘 행동 완료' },
    }
    const api = createApi(copyIsNotState)
    renderToday(api)

    expect(await screen.findByRole('heading', { name: '오늘 행동 완료' })).toBeVisible()
    expect(screen.getByRole('button', { name: '완료했어요' })).toBeEnabled()
    expect(screen.queryByText('오늘은 여기까지면 충분해요')).not.toBeInTheDocument()
  })

  it('locks completion so repeated activation sends one request', async () => {
    let resolveComplete!: (value: TodayView) => void
    const complete = vi.fn(
      () => new Promise<TodayView>((resolve) => {
        resolveComplete = resolve
      }),
    )
    const api = { ...createApi(), complete }
    renderToday(api)

    const button = await screen.findByRole('button', { name: '완료했어요' })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(complete).toHaveBeenCalledOnce()
    expect(complete).toHaveBeenCalledWith(quest.id, quest.version)

    await act(async () => resolveComplete(completed))
    expect(await screen.findByRole('heading', { name: '오늘은 여기까지면 충분해요' })).toBeVisible()
  })

  it('preserves block input after a network error and explains the smaller retry', async () => {
    const block = vi
      .fn<QuestApi['block']>()
      .mockRejectedValueOnce(
        new ApiError({ code: 'NETWORK_ERROR', message: '연결이 끊겼어요.', status: 0 }),
      )
      .mockResolvedValueOnce(smallerActive)
    const api = { ...createApi(), block }
    renderToday(api)
    await screen.findByRole('heading', { name: quest.title })

    fireEvent.click(screen.getByRole('button', { name: '지금은 막혔어요' }))
    const barrier = screen.getByLabelText('행동이 너무 크게 느껴져요')
    const note = screen.getByRole('textbox', { name: '메모 (선택)' })
    fireEvent.click(barrier)
    fireEvent.change(note, { target: { value: '조금 더 나누고 싶어요.' } })
    fireEvent.click(screen.getByRole('button', { name: '더 작은 행동으로 바꾸기' }))

    expect(await screen.findByText('연결이 끊겼어요.')).toBeVisible()
    expect(barrier).toBeChecked()
    expect(note).toHaveValue('조금 더 나누고 싶어요.')
    fireEvent.click(screen.getByRole('button', { name: '더 작은 행동으로 바꾸기' }))

    expect(await screen.findByText(`이전 행동: ${quest.title}`)).toBeVisible()
    expect(screen.getByText(/13분 짧아졌어요/)).toBeVisible()
    expect(screen.getByRole('heading', { name: smallerQuest.title })).toBeVisible()
    expect(screen.queryByRole('button', { name: '지금은 막혔어요' })).not.toBeInTheDocument()
    expect(block).toHaveBeenLastCalledWith(quest.id, {
      barrier: 'TOO_LARGE',
      note: '조금 더 나누고 싶어요.',
      version: quest.version,
    })
  })

  it('reloads today after STALE_QUEST instead of inferring the next screen', async () => {
    const api = createApi()
    vi.mocked(api.today).mockResolvedValueOnce(active).mockResolvedValueOnce(completed)
    vi.mocked(api.complete).mockRejectedValueOnce(
      new ApiError({ code: 'STALE_QUEST', message: '이미 상태가 바뀌었어요.', status: 409 }),
    )
    renderToday(api)

    fireEvent.click(await screen.findByRole('button', { name: '완료했어요' }))

    expect(await screen.findByRole('heading', { name: '오늘은 여기까지면 충분해요' })).toBeVisible()
    expect(api.today).toHaveBeenCalledTimes(2)
    expect(screen.getByText(/최신 내용으로 다시 불러왔어요/)).toBeVisible()
  })

  it('shows a keyboard-operable retry when loading today fails', async () => {
    const api = createApi()
    vi.mocked(api.today)
      .mockRejectedValueOnce(
        new ApiError({ code: 'NETWORK_ERROR', message: '서버에 연결하지 못했어요.', status: 0 }),
      )
      .mockResolvedValueOnce(checkInRequired)
    renderToday(api)

    const retry = await screen.findByRole('button', { name: '오늘 다시 불러오기' })
    retry.focus()
    expect(retry).toHaveFocus()
    fireEvent.keyDown(retry, { key: 'Enter' })
    fireEvent.click(retry)

    expect(await screen.findByRole('heading', { name: '지금 가능한 만큼만 골라요' })).toBeVisible()
    await waitFor(() => expect(api.today).toHaveBeenCalledTimes(2))
  })
})
