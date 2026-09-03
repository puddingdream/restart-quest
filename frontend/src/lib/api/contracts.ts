export type User = {
  email: string
  id: string
}

export type AuthResponse = {
  user: User
}

export type FieldErrors = Record<string, string>

type JsonRecord = Record<string, unknown>

export function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseAuthResponse(value: unknown): AuthResponse {
  if (!isJsonRecord(value) || !isJsonRecord(value.user)) {
    throw new Error('인증 응답 형식이 올바르지 않습니다.')
  }

  const { email, id } = value.user

  if (typeof email !== 'string' || typeof id !== 'string') {
    throw new Error('인증 사용자 응답 형식이 올바르지 않습니다.')
  }

  return { user: { email, id } }
}
