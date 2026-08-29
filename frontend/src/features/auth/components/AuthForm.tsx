import { useState, type FormEvent } from 'react'
import type { AuthFormValues } from '../types'
import {
  validateAuthForm,
  type AuthFormErrors,
} from '../validation'

interface AuthFormProps {
  mode: 'login' | 'signup'
  isSubmitting: boolean
  apiError: string | null
  apiFieldErrors?: AuthFormErrors
  onSubmit: (values: AuthFormValues) => Promise<void>
  onFieldChange?: (field: keyof AuthFormValues) => void
}

export function AuthForm({
  mode,
  isSubmitting,
  apiError,
  apiFieldErrors = {},
  onSubmit,
  onFieldChange,
}: AuthFormProps) {
  const [values, setValues] = useState<AuthFormValues>({
    email: '',
    password: '',
    name: '',
  })
  const [errors, setErrors] = useState<AuthFormErrors>({})
  const visibleErrors = { ...apiFieldErrors, ...errors }

  function updateField<K extends keyof AuthFormValues>(
    field: K,
    value: AuthFormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    onFieldChange?.(field)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validateAuthForm(values, mode)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    await onSubmit(values)
  }

  const isSignup = mode === 'signup'

  return (
    <form className="form-stack" onSubmit={handleSubmit} noValidate>
      {apiError && (
        <div className="alert alert-error" role="alert">
          <span aria-hidden="true">!</span>
          <p>{apiError}</p>
        </div>
      )}

      {isSignup && (
        <div className="field-group">
          <label htmlFor="name">이름</label>
          <input
            id="name"
            name="name"
            autoComplete="name"
            value={values.name}
            onChange={(event) => updateField('name', event.target.value)}
            aria-invalid={Boolean(visibleErrors.name)}
            aria-describedby={visibleErrors.name ? 'name-error' : undefined}
            maxLength={40}
            disabled={isSubmitting}
          />
          {visibleErrors.name && (
            <p className="field-error" id="name-error">
              {visibleErrors.name}
            </p>
          )}
        </div>
      )}

      <div className="field-group">
        <label htmlFor="email">이메일</label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={values.email}
          onChange={(event) => updateField('email', event.target.value)}
          aria-invalid={Boolean(visibleErrors.email)}
          aria-describedby={visibleErrors.email ? 'email-error' : undefined}
          disabled={isSubmitting}
        />
        {visibleErrors.email && (
          <p className="field-error" id="email-error">
            {visibleErrors.email}
          </p>
        )}
      </div>

      <div className="field-group">
        <label htmlFor="password">비밀번호</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          placeholder="8자 이상 입력해 주세요"
          value={values.password}
          onChange={(event) => updateField('password', event.target.value)}
          aria-invalid={Boolean(visibleErrors.password)}
          aria-describedby={
            visibleErrors.password ? 'password-error' : undefined
          }
          minLength={8}
          maxLength={72}
          disabled={isSubmitting}
        />
        {visibleErrors.password && (
          <p className="field-error" id="password-error">
            {visibleErrors.password}
          </p>
        )}
      </div>

      <button className="button button-primary button-full" disabled={isSubmitting}>
        {isSubmitting && <span className="spinner" aria-hidden="true" />}
        {isSubmitting
          ? isSignup
            ? '계정을 만들고 있어요'
            : '로그인하고 있어요'
          : isSignup
            ? '작은 시작 준비하기'
            : '오늘의 퀘스트로 이동'}
      </button>
    </form>
  )
}
