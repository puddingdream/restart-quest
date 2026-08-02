import { useState, type FormEvent } from 'react'

export interface AuthFormValues {
  email: string
  password: string
  name: string
}

interface AuthFormProps {
  mode: 'login' | 'signup'
  isSubmitting: boolean
  apiError: string | null
  onSubmit: (values: AuthFormValues) => Promise<void>
}

type AuthFormErrors = Partial<Record<keyof AuthFormValues, string>>

function validate(
  values: AuthFormValues,
  mode: AuthFormProps['mode'],
): AuthFormErrors {
  const errors: AuthFormErrors = {}
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = '이메일 형식을 확인해 주세요.'
  }
  if (values.password.length < 8 || values.password.length > 72) {
    errors.password = '비밀번호는 8~72자로 입력해 주세요.'
  }
  if (mode === 'signup') {
    const nameLength = values.name.trim().length
    if (nameLength < 2 || nameLength > 40) {
      errors.name = '이름은 2~40자로 입력해 주세요.'
    }
  }
  return errors
}

export function AuthForm({
  mode,
  isSubmitting,
  apiError,
  onSubmit,
}: AuthFormProps) {
  const [values, setValues] = useState<AuthFormValues>({
    email: '',
    password: '',
    name: '',
  })
  const [errors, setErrors] = useState<AuthFormErrors>({})

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validate(values, mode)
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
            onChange={(event) =>
              setValues((current) => ({ ...current, name: event.target.value }))
            }
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'name-error' : undefined}
            maxLength={40}
            disabled={isSubmitting}
          />
          {errors.name && (
            <p className="field-error" id="name-error">
              {errors.name}
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
          onChange={(event) =>
            setValues((current) => ({ ...current, email: event.target.value }))
          }
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'email-error' : undefined}
          disabled={isSubmitting}
        />
        {errors.email && (
          <p className="field-error" id="email-error">
            {errors.email}
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
          onChange={(event) =>
            setValues((current) => ({ ...current, password: event.target.value }))
          }
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'password-error' : undefined}
          minLength={8}
          maxLength={72}
          disabled={isSubmitting}
        />
        {errors.password && (
          <p className="field-error" id="password-error">
            {errors.password}
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
