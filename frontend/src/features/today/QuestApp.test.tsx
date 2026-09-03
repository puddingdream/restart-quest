import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../lib/api/ApiClient'
import { QueryClient } from '../../lib/query/QueryClient'
import type { AuthApi } from '../auth/authApi'
import type { HistoryApi } from '../history/historyApi'
import { QuestApp } from './QuestApp'
import type { QuestApi } from './questApi'

afterEach(() => {
  cleanup()
})

describe('QuestApp', () => {
  it('enters the protected today flow after registration and marks its navigation item', async () => {
    window.history.replaceState(null, '', '/register')
    const user = { email: 'restart@example.com', id: 'account-1' }
    const authApi: AuthApi = {
      login: vi.fn(async () => user),
      logout: vi.fn(async () => undefined),
      me: vi.fn(async () => {
        throw new ApiError({ code: 'AUTH_REQUIRED', message: '로그인이 필요합니다.', status: 401 })
      }),
      onUnauthorized: vi.fn(() => () => undefined),
      register: vi.fn(async () => user),
    }
    const questApi: QuestApi = {
      block: vi.fn(),
      checkIn: vi.fn(),
      complete: vi.fn(),
      today: vi.fn<QuestApi['today']>(async () => ({
        activeQuest: null,
        checkIn: null,
        completedQuest: null,
        date: '2026-09-03',
        phase: 'CHECK_IN_REQUIRED',
      })),
    }
    const historyApi: HistoryApi = { history: vi.fn(async () => ({ days: [] })) }
    render(
      <QuestApp
        authApi={authApi}
        historyApi={historyApi}
        queryClient={new QueryClient()}
        questApi={questApi}
      />,
    )

    await screen.findByRole('heading', { name: '계정 만들기' })
    fireEvent.change(screen.getByRole('textbox', { name: '이메일' }), {
      target: { value: user.email },
    })
    fireEvent.change(screen.getByLabelText('비밀번호'), {
      target: { value: 'safe-password-1234' },
    })
    fireEvent.click(screen.getByRole('button', { name: '계정 만들기' }))

    expect(await screen.findByRole('heading', { name: '지금 가능한 만큼만 골라요' })).toBeVisible()
    expect(window.location.pathname).toBe('/today')
    expect(screen.getByRole('link', { name: '오늘' })).toHaveAttribute('aria-current', 'page')
    expect(authApi.register).toHaveBeenCalledOnce()
    expect(questApi.today).toHaveBeenCalledOnce()
  })
})
