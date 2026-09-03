import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '../../lib/query/QueryClient'
import type { HistoryApi } from './historyApi'
import { HistoryPage } from './HistoryPage'

afterEach(() => {
  cleanup()
})

describe('HistoryPage', () => {
  it('requests 14 Seoul calendar days and renders completion and retry newest first', async () => {
    const history = vi.fn<HistoryApi['history']>(async () => ({
      days: [
        {
          checkIn: { availableMinutes: 5, energyLevel: 'LOW', focusArea: 'EXPLORE' },
          date: '2026-08-31',
          outcomes: [
            {
              barrier: null,
              createdAt: '2026-08-31T01:00:00Z',
              note: null,
              quest: {
                difficulty: 1,
                estimatedMinutes: 5,
                id: 'old-complete',
                title: '검색어 하나 적기',
              },
              type: 'COMPLETED',
            },
          ],
        },
        {
          checkIn: { availableMinutes: 15, energyLevel: 'MEDIUM', focusArea: 'RESUME' },
          date: '2026-09-02',
          outcomes: [
            {
              barrier: 'TOO_LARGE',
              createdAt: '2026-09-02T01:00:00Z',
              note: '한 줄부터 다시 보기',
              quest: {
                difficulty: 2,
                estimatedMinutes: 15,
                id: 'retry',
                title: '경력 한 줄 다듬기',
              },
              type: 'BLOCKED',
            },
          ],
        },
      ],
    }))
    render(<HistoryPage api={{ history }} queryClient={new QueryClient()} />)

    expect(await screen.findByRole('heading', { name: '다시 시작한 기록' })).toBeVisible()
    expect(screen.getByText('더 작게 재시도')).toBeVisible()
    expect(screen.getByText('완료')).toBeVisible()
    expect(screen.getByText('내 메모: 한 줄부터 다시 보기')).toBeVisible()

    const [from, to] = history.mock.calls[0]
    const inclusiveDays =
      (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) /
        86_400_000 +
      1
    expect(inclusiveDays).toBe(14)
    const dayHeadings = screen.getAllByRole('heading', { level: 2 })
    expect(dayHeadings[0]).toHaveTextContent('9월 2일')
    expect(dayHeadings[1]).toHaveTextContent('8월 31일')
  })

  it('moves an empty history to today with a keyboard-operable link', async () => {
    window.history.replaceState(null, '', '/history')
    const api: HistoryApi = { history: vi.fn(async () => ({ days: [] })) }
    render(<HistoryPage api={api} queryClient={new QueryClient()} />)

    const todayLink = await screen.findByRole('link', { name: '오늘로 이동하기' })
    expect(todayLink).toHaveAttribute('href', '/today')
    todayLink.focus()
    expect(todayLink).toHaveFocus()
    fireEvent.click(todayLink)
    await waitFor(() => expect(window.location.pathname).toBe('/today'))
  })
})
