import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('provides the accessible shell, auth entry, and product boundary copy', async () => {
    window.history.replaceState(null, '', '/')
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ code: 'AUTH_REQUIRED', message: '로그인이 필요합니다.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

    expect(
      screen.getByRole('heading', { name: '막히면 더 작게, 오늘 다시 시작하기' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '본문으로 건너뛰기' })).toHaveAttribute(
      'href',
      '#main-content',
    )
    expect(screen.getByRole('link', { name: '계정 만들고 시작하기' })).toHaveAttribute(
      'href',
      '/register',
    )
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
    expect(screen.getByText(/전문 상담이나 의료 서비스를 대신하지 않습니다/)).toBeVisible()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    vi.unstubAllGlobals()
  })
})
