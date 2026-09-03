import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../lib/api/ApiClient'
import type { User } from '../../lib/api/contracts'
import { QueryClient } from '../../lib/query/QueryClient'
import { AuthApp } from './AuthApp'
import type { AuthApi, Credentials } from './authApi'

const user: User = { email: 'restart@example.com', id: 'account-1' }

function authRequired(): ApiError {
  return new ApiError({
    code: 'AUTH_REQUIRED',
    message: '로그인이 필요합니다.',
    status: 401,
  })
}

function createAuthApi(options: {
  login?: (credentials: Credentials) => Promise<User>
  me?: () => Promise<User>
  register?: (credentials: Credentials) => Promise<User>
} = {}) {
  let unauthorizedListener: () => void = () => undefined
  const api: AuthApi = {
    login: vi.fn(options.login ?? (async () => user)),
    logout: vi.fn(async () => undefined),
    me: vi.fn(options.me ?? (async () => user)),
    onUnauthorized: vi.fn((listener: () => void) => {
      unauthorizedListener = listener
      return () => {
        unauthorizedListener = () => undefined
      }
    }),
    register: vi.fn(options.register ?? (async () => user)),
  }

  return {
    api,
    expireSession: () => unauthorizedListener(),
  }
}

function renderAuth(api: AuthApi) {
  return render(<AuthApp api={api} queryClient={new QueryClient()} />)
}

describe('AuthApp', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
  })

  afterEach(() => {
    cleanup()
  })

  it('restores the session with me before showing a protected account route', async () => {
    const { api } = createAuthApi()
    window.history.replaceState(null, '', '/account')

    renderAuth(api)

    expect(await screen.findByRole('heading', { name: '내 계정' })).toBeVisible()
    expect(screen.getByText('restart@example.com')).toBeVisible()
    expect(api.me).toHaveBeenCalledOnce()
  })

  it('preserves the protected destination when an authenticated session expires', async () => {
    const { api, expireSession } = createAuthApi()
    window.history.replaceState(null, '', '/account')
    renderAuth(api)
    await screen.findByRole('heading', { name: '내 계정' })

    act(() => expireSession())

    expect(await screen.findByRole('heading', { name: '로그인' })).toBeVisible()
    expect(window.location.pathname).toBe('/login')
    expect(new URLSearchParams(window.location.search).get('returnTo')).toBe('/account')
  })

  it('connects server field errors and clears the password so the login can be retried', async () => {
    const login = vi.fn(async () => {
      throw new ApiError({
        code: 'INVALID_CREDENTIALS',
        fieldErrors: { email: '이메일 또는 비밀번호를 확인해 주세요.' },
        message: '로그인 정보를 확인해 주세요.',
        status: 401,
      })
    })
    const { api } = createAuthApi({ login, me: async () => Promise.reject(authRequired()) })
    window.history.replaceState(null, '', '/login')
    renderAuth(api)
    await screen.findByRole('heading', { name: '로그인' })

    const email = screen.getByRole('textbox', { name: '이메일' })
    const password = screen.getByLabelText('비밀번호')
    fireEvent.change(email, { target: { value: 'restart@example.com' } })
    fireEvent.change(password, { target: { value: 'long-enough-password' } })
    fireEvent.submit(screen.getByRole('form', { name: '로그인' }))

    expect(await screen.findByText('이메일 또는 비밀번호를 확인해 주세요.')).toBeVisible()
    expect(screen.getByText('로그인 정보를 확인해 주세요.')).toBeVisible()
    expect(email).toHaveValue('restart@example.com')
    expect(email).toHaveAccessibleDescription('이메일 또는 비밀번호를 확인해 주세요.')
    expect(password).toHaveValue('')
  })

  it('clears a locally invalid password without sending it', async () => {
    const { api } = createAuthApi({ me: async () => Promise.reject(authRequired()) })
    window.history.replaceState(null, '', '/register')
    renderAuth(api)
    await screen.findByRole('heading', { name: '계정 만들기' })

    const password = screen.getByLabelText('비밀번호')
    fireEvent.change(screen.getByRole('textbox', { name: '이메일' }), {
      target: { value: 'restart@example.com' },
    })
    fireEvent.change(password, { target: { value: 'short' } })
    fireEvent.submit(screen.getByRole('form', { name: '계정 만들기' }))

    expect(await screen.findByText('비밀번호는 10~72자로 입력해 주세요.')).toBeVisible()
    expect(password).toHaveValue('')
    expect(api.register).not.toHaveBeenCalled()
  })

  it('retries a failed me request and shows the account safety boundary', async () => {
    const me = vi
      .fn<() => Promise<User>>()
      .mockRejectedValueOnce(
        new ApiError({ code: 'NETWORK_ERROR', message: '서버 연결 오류', status: 0 }),
      )
      .mockResolvedValueOnce(user)
    const { api } = createAuthApi({ me })
    window.history.replaceState(null, '', '/account')
    renderAuth(api)

    expect(await screen.findByText('서버 연결 오류')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: '세션 다시 확인' }))

    expect(await screen.findByRole('heading', { name: '내 계정' })).toBeVisible()
    expect(
      screen.getByText(/전문 상담이나 의료 서비스를 대신하지 않습니다/),
    ).toBeVisible()
    await waitFor(() => expect(me).toHaveBeenCalledTimes(2))
  })
})
