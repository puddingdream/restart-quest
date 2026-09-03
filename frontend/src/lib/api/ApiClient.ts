import { isJsonRecord, type FieldErrors } from './contracts'

export type ResponseParser<T> = (value: unknown) => T

export class ApiError extends Error {
  readonly code: string
  readonly fieldErrors: FieldErrors
  readonly retryAfter: number | null
  readonly status: number

  constructor(options: {
    code: string
    fieldErrors?: FieldErrors
    message: string
    retryAfter?: number | null
    status: number
  }) {
    super(options.message)
    this.name = 'ApiError'
    this.code = options.code
    this.fieldErrors = options.fieldErrors ?? {}
    this.retryAfter = options.retryAfter ?? null
    this.status = options.status
  }
}

type CsrfToken = {
  headerName: string
  token: string
}

type WriteOptions<T> = {
  body?: unknown
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  parse?: ResponseParser<T>
  rotatesSession?: boolean
}

const csrfHeaderPattern = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/

function parseFieldErrors(value: unknown): FieldErrors {
  if (!isJsonRecord(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )
}

function parseRetryAfter(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) {
    return null
  }

  return Number(value)
}

async function responseJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('Content-Type') ?? ''

  if (!contentType.toLowerCase().includes('application/json')) {
    return null
  }

  try {
    return await response.json()
  } catch {
    return null
  }
}

function parseCsrf(value: unknown): CsrfToken {
  if (!isJsonRecord(value)) {
    throw new Error('CSRF 응답 형식이 올바르지 않습니다.')
  }

  const { headerName, token } = value

  if (
    typeof headerName !== 'string' ||
    !csrfHeaderPattern.test(headerName) ||
    typeof token !== 'string' ||
    token.length === 0
  ) {
    throw new Error('CSRF 응답 형식이 올바르지 않습니다.')
  }

  return { headerName, token }
}

export class ApiClient {
  private csrfToken: CsrfToken | null = null
  private readonly fetchImpl: typeof fetch
  private readonly unauthorizedListeners = new Set<() => void>()

  constructor(fetchImpl: typeof fetch = (input, init) => fetch(input, init)) {
    this.fetchImpl = fetchImpl
  }

  onUnauthorized(listener: () => void): () => void {
    this.unauthorizedListeners.add(listener)
    return () => this.unauthorizedListeners.delete(listener)
  }

  async get<T>(path: string, parse: ResponseParser<T>): Promise<T> {
    return this.request(path, { method: 'GET' }, parse)
  }

  async write<T = void>(path: string, options: WriteOptions<T> = {}): Promise<T> {
    const csrf = await this.getCsrfToken()
    const headers = new Headers()
    headers.set(csrf.headerName, csrf.token)

    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json')
    }

    try {
      return await this.request(
        path,
        {
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          headers,
          method: options.method ?? 'POST',
        },
        options.parse,
      )
    } finally {
      if (options.rotatesSession) {
        this.csrfToken = null
      }
    }
  }

  invalidateCsrf(): void {
    this.csrfToken = null
  }

  private async getCsrfToken(): Promise<CsrfToken> {
    if (this.csrfToken) {
      return this.csrfToken
    }

    const token = await this.request('/api/v1/auth/csrf', { method: 'GET' }, parseCsrf)
    this.csrfToken = token
    return token
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    parse?: ResponseParser<T>,
  ): Promise<T> {
    let response: Response

    try {
      response = await this.fetchImpl(path, {
        ...init,
        credentials: 'same-origin',
      })
    } catch {
      throw new ApiError({
        code: 'NETWORK_ERROR',
        message: '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        status: 0,
      })
    }

    const body = response.status === 204 ? null : await responseJson(response)

    if (!response.ok) {
      if (response.status === 401) {
        this.unauthorizedListeners.forEach((listener) => listener())
      }

      const errorBody = isJsonRecord(body) ? body : {}
      throw new ApiError({
        code: typeof errorBody.code === 'string' ? errorBody.code : 'UNKNOWN_ERROR',
        fieldErrors: parseFieldErrors(errorBody.fieldErrors),
        message:
          typeof errorBody.message === 'string'
            ? errorBody.message
            : '요청을 처리하지 못했습니다. 다시 시도해 주세요.',
        retryAfter: parseRetryAfter(response.headers.get('Retry-After')),
        status: response.status,
      })
    }

    if (!parse) {
      return undefined as T
    }

    try {
      return parse(body)
    } catch {
      throw new ApiError({
        code: 'INVALID_RESPONSE',
        message: '서버 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        status: response.status,
      })
    }
  }
}

export const apiClient = new ApiClient()
