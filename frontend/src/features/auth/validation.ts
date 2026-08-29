import { ApiError } from '../../shared/api/ApiError'
import type { AuthFormValues } from './types'

export type AuthFormErrors = Partial<Record<keyof AuthFormValues, string>>

const SAFE_AUTH_FIELD_MESSAGES: Record<keyof AuthFormValues, string> = {
  email: '이메일 형식을 확인해 주세요.',
  password:
    '비밀번호는 8자 이상이며 UTF-8 기준 72바이트 이하로 입력해 주세요.',
  name: '이름은 2~40자로 입력해 주세요.',
}

function isAuthField(field: string): field is keyof AuthFormValues {
  return field === 'email' || field === 'password' || field === 'name'
}

export function validateAuthForm(
  values: AuthFormValues,
  mode: 'login' | 'signup',
): AuthFormErrors {
  const errors: AuthFormErrors = {}
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = SAFE_AUTH_FIELD_MESSAGES.email
  }

  const passwordBytes = new TextEncoder().encode(values.password).byteLength
  if (values.password.length < 8 || passwordBytes > 72) {
    errors.password = SAFE_AUTH_FIELD_MESSAGES.password
  }

  if (mode === 'signup') {
    const nameLength = values.name.trim().length
    if (nameLength < 2 || nameLength > 40) {
      errors.name = SAFE_AUTH_FIELD_MESSAGES.name
    }
  }
  return errors
}

export function getAuthFieldErrors(
  error: unknown,
  mode: 'login' | 'signup',
): AuthFormErrors {
  if (!(error instanceof ApiError) || error.code !== 'INVALID_INPUT') return {}

  return error.fieldErrors.reduce<AuthFormErrors>((errors, { field }) => {
    if (!isAuthField(field) || (mode === 'login' && field === 'name')) {
      return errors
    }

    errors[field] = SAFE_AUTH_FIELD_MESSAGES[field]
    return errors
  }, {})
}
