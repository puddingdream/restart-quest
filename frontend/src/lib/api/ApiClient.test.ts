import { describe, expect, it, vi } from 'vitest'
import { ApiClient, ApiError } from './ApiClient'
import { parseAuthResponse } from './contracts'

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
}

describe('ApiClient', () => {
  it('uses the server-provided CSRF header and refreshes the token after session rotation', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ headerName: 'X-ReStart-CSRF', token: 'before' }))
      .mockResolvedValueOnce(
        jsonResponse({ user: { email: 'user@example.com', id: 'user-1' } }),
      )
      .mockResolvedValueOnce(jsonResponse({ headerName: 'X-Rotated-CSRF', token: 'after' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const client = new ApiClient(fetchMock)

    await client.write('/api/v1/auth/login', {
      body: { email: 'user@example.com', password: 'not-logged-password' },
      parse: parseAuthResponse,
      rotatesSession: true,
    })
    await client.write('/api/v1/auth/logout', { rotatesSession: true })

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/auth/csrf')
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get('X-ReStart-CSRF')).toBe(
      'before',
    )
    expect(fetchMock.mock.calls[2][0]).toBe('/api/v1/auth/csrf')
    expect(new Headers(fetchMock.mock.calls[3][1]?.headers).get('X-Rotated-CSRF')).toBe(
      'after',
    )
  })

  it('maps field errors and notifies listeners when authentication expires', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse(
        {
          code: 'AUTH_REQUIRED',
          fieldErrors: { email: '이메일을 확인해 주세요.' },
          message: '로그인이 필요합니다.',
        },
        { status: 401 },
      ),
    )
    const client = new ApiClient(fetchMock)
    const onUnauthorized = vi.fn()
    client.onUnauthorized(onUnauthorized)

    const request = client.get('/api/v1/auth/me', parseAuthResponse)

    await expect(request).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
      fieldErrors: { email: '이메일을 확인해 주세요.' },
      status: 401,
    } satisfies Partial<ApiError>)
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })
})
