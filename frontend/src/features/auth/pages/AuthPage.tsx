import { useState } from 'react'
import { getApiErrorMessage } from '../../../shared/api/ApiError'
import { AppLink } from '../../../app/components/AppLink'
import { Brand } from '../../../app/components/Brand'
import { useAuth } from '../AuthContext'
import { AuthForm } from '../components/AuthForm'
import type { AuthFormValues } from '../types'
import {
  getAuthFieldErrors,
  type AuthFormErrors,
} from '../validation'

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { login, signup } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [apiFieldErrors, setApiFieldErrors] = useState<AuthFormErrors>({})
  const isSignup = mode === 'signup'

  async function handleSubmit(values: AuthFormValues) {
    setIsSubmitting(true)
    setApiError(null)
    setApiFieldErrors({})
    try {
      if (isSignup) {
        await signup({
          email: values.email.trim(),
          password: values.password,
          name: values.name.trim(),
        })
      } else {
        await login({
          email: values.email.trim(),
          password: values.password,
        })
      }
    } catch (error) {
      setApiFieldErrors(getAuthFieldErrors(error, mode))
      setApiError(getApiErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  function clearApiFieldError(field: keyof AuthFormValues) {
    setApiError(null)
    setApiFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  return (
    <main className="auth-layout">
      <section className="auth-story" aria-labelledby="auth-story-title">
        <Brand />
        <div className="story-copy">
          <p className="eyebrow">오늘 할 수 있는 만큼만</p>
          <h1 id="auth-story-title">
            큰 계획보다,
            <br />
            <span>작은 행동 하나부터.</span>
          </h1>
          <p>
            지금의 준비 상태를 알려주면 오늘 시작할 수 있는 구직 행동으로
            나눠드려요.
          </p>
        </div>
        <div className="story-step" aria-label="서비스 핵심 흐름">
          <span className="step-number">01</span>
          <div>
            <strong>상태를 짧게 알려주세요</strong>
            <p>평가가 아닌, 알맞은 시작점을 찾기 위한 정보예요.</p>
          </div>
        </div>
      </section>

      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-card">
          <p className="eyebrow">Re:Start here</p>
          <h2 id="auth-title">
            {isSignup ? '다시 시작할 준비를 해볼까요?' : '오늘도 가볍게 이어가요'}
          </h2>
          <p className="auth-subtitle">
            {isSignup
              ? '계정을 만들고 나에게 맞는 시작점을 설정해요.'
              : '로그인하면 오늘 할 수 있는 작은 행동으로 바로 이동해요.'}
          </p>

          <AuthForm
            mode={mode}
            isSubmitting={isSubmitting}
            apiError={apiError}
            apiFieldErrors={apiFieldErrors}
            onSubmit={handleSubmit}
            onFieldChange={clearApiFieldError}
          />

          <p className="auth-switch">
            {isSignup ? '이미 계정이 있나요?' : '처음 방문하셨나요?'}{' '}
            <AppLink to={isSignup ? '/login' : '/signup'}>
              {isSignup ? '로그인' : '회원가입'}
            </AppLink>
          </p>
        </div>
      </section>
    </main>
  )
}
