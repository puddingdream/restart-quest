import { ApiError, type FieldError } from './ApiError'
import { resolveApiMode } from './apiMode'
import { createApiUrl } from './apiUrl'
import { getAccessToken } from '../auth/sessionToken'

interface MockRequestContext {
  accessToken: string | null
}

interface RequestOptions<T> {
  method?: 'GET' | 'POST' | 'PUT'
  body?: unknown
  mock?: (context: MockRequestContext) => Promise<T> | T
}

interface ErrorPayload {
  code?: unknown
  message?: unknown
  fieldErrors?: unknown
}

function readFieldErrors(value: unknown): FieldError[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    if (
      typeof item === 'object' &&
      item !== null &&
      typeof Reflect.get(item, 'field') === 'string' &&
      typeof Reflect.get(item, 'reason') === 'string'
    ) {
      return [
        {
          field: Reflect.get(item, 'field') as string,
          reason: Reflect.get(item, 'reason') as string,
        },
      ]
    }
    return []
  })
}

async function toApiError(response: Response): Promise<ApiError> {
  let payload: ErrorPayload = {}
  try {
    payload = (await response.json()) as ErrorPayload
  } catch {
    // 오류 본문이나 파싱 세부 정보는 사용자 화면에 전달하지 않는다.
  }

  const code = typeof payload.code === 'string' ? payload.code : 'REQUEST_FAILED'
  const message =
    typeof payload.message === 'string'
      ? payload.message
      : '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
  return new ApiError(
    response.status,
    code,
    message,
    readFieldErrors(payload.fieldErrors),
  )
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions<T> = {},
): Promise<T> {
  const method = options.method ?? 'GET'
  const accessToken = getAccessToken()
  const documentMode =
    typeof document === 'undefined'
      ? undefined
      : document
          .querySelector<HTMLMetaElement>('meta[name="restart-quest-api-mode"]')
          ?.getAttribute('content')
  const apiMode = resolveApiMode(import.meta.env?.VITE_API_MODE, documentMode)

  if (apiMode === 'mock') {
    if (!options.mock) {
      throw new ApiError(404, 'NOT_FOUND', '요청한 기능을 찾을 수 없습니다.')
    }
    return options.mock({ accessToken })
  }

  const response = await fetch(
    createApiUrl(path, import.meta.env?.VITE_API_BASE_URL),
    {
      method,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    },
  )

  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
