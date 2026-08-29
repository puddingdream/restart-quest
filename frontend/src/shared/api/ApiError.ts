export interface FieldError {
  field: string
  reason: string
}

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly fieldErrors: FieldError[]

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors: FieldError[] = [],
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

const SAFE_MESSAGES: Record<string, string> = {
  EMAIL_ALREADY_EXISTS: '이미 사용 중인 이메일입니다.',
  INVALID_CREDENTIALS: '이메일 또는 비밀번호를 확인해 주세요.',
  SESSION_EXPIRED: '로그인 시간이 만료되었습니다. 다시 로그인해 주세요.',
  INVALID_INPUT: '입력한 내용을 다시 확인해 주세요.',
  VALIDATION_ERROR: '입력한 내용을 다시 확인해 주세요.',
  ONBOARDING_NOT_FOUND: '아직 작성한 온보딩 정보가 없습니다.',
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return (
      SAFE_MESSAGES[error.code] ??
      '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
    )
  }

  return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

export function isSessionExpired(error: unknown): boolean {
  return error instanceof ApiError && [401, 403].includes(error.status)
}
