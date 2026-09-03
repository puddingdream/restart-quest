import {
  useEffect,
  useState,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { Button } from '../../components/Button'
import { FormField } from '../../components/FormField'
import { LoadingIndicator } from '../../components/LoadingIndicator'
import { StatusNotice } from '../../components/StatusNotice'
import { ApiError } from '../../lib/api/ApiClient'
import type { QueryClient } from '../../lib/query/QueryClient'
import { AuthProvider } from './AuthProvider'
import type { AuthApi } from './authApi'
import { useAuth } from './authContext'
import { navigate, safeReturnTo, useLocationPath } from './routing'

type AppLinkProps = {
  children: ReactNode
  className?: string
  to: string
}

function AppLink({ children, className, to }: AppLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }

    event.preventDefault()
    navigate(to)
  }

  return (
    <a className={className} href={to} onClick={handleClick}>
      {children}
    </a>
  )
}

function LandingPage() {
  const { status } = useAuth()

  return (
    <>
      <section className="hero" aria-labelledby="welcome-title">
        <p className="eyebrow">오늘의 재시작</p>
        <h1 id="welcome-title">막히면 더 작게, 오늘 다시 시작하기</h1>
        <p className="hero__description">
          지금 쓸 수 있는 시간과 에너지에 맞춰, 끝낼 수 있는 구직 행동 한 가지에
          집중해요.
        </p>
        <div className="hero__actions">
          {status === 'authenticated' ? (
            <AppLink className="button button--primary" to="/account">
              내 계정 보기
            </AppLink>
          ) : (
            <AppLink className="button button--primary" to="/register">
              계정 만들고 시작하기
            </AppLink>
          )}
        </div>
      </section>

      <div id="restart-guide">
        <StatusNotice
          title="작은 시작도 기록할 수 있어요"
          description="완료하지 못해도 괜찮아요. 막힌 이유를 고르면 더 쉬운 다음 행동으로 이어집니다."
        />
      </div>
      {status !== 'authenticated' ? <AppLink to="/login">이미 계정이 있나요? 로그인</AppLink> : null}
    </>
  )
}

type AuthMode = 'login' | 'register'

function validateCredentials(email: string, password: string): Record<string, string> {
  const fieldErrors: Record<string, string> = {}

  if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
    fieldErrors.email = '올바른 이메일을 입력해 주세요.'
  }

  if (password.length < 10 || password.length > 72) {
    fieldErrors.password = '비밀번호는 10~72자로 입력해 주세요.'
  }

  return fieldErrors
}

function AuthForm({ mode }: { mode: AuthMode }) {
  const { login, register, status } = useAuth()
  const location = useLocationPath()
  const url = new URL(location, window.location.origin)
  const returnTo = safeReturnTo(url.searchParams.get('returnTo'))
  const isRegister = mode === 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [commonError, setCommonError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (status === 'authenticated') {
      navigate(returnTo, { replace: true })
    }
  }, [returnTo, status])

  if (status === 'restoring' || status === 'authenticated') {
    return <LoadingIndicator label="세션 확인 중" />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors = validateCredentials(email, password)

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      setCommonError('입력 내용을 확인해 주세요.')
      setPassword('')
      return
    }

    setIsSubmitting(true)
    setCommonError(null)
    setFieldErrors({})

    try {
      const credentials = { email: email.trim(), password }
      if (isRegister) {
        await register(credentials)
      } else {
        await login(credentials)
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors(error.fieldErrors)
        setCommonError(error.message)
      } else {
        setCommonError('요청을 처리하지 못했습니다. 다시 시도해 주세요.')
      }
    } finally {
      setPassword('')
      setIsSubmitting(false)
    }
  }

  const title = isRegister ? '계정 만들기' : '로그인'

  return (
    <section className="hero" aria-labelledby="auth-title">
      <p className="eyebrow">{isRegister ? '첫 번째 작은 행동' : '다시 이어가기'}</p>
      <h1 id="auth-title">{title}</h1>
      <form aria-label={title} onSubmit={handleSubmit} noValidate>
        {commonError ? (
          <StatusNotice tone="error" title={`${title}하지 못했어요`} description={commonError} />
        ) : null}
        <FormField
          id={`${mode}-email`}
          label="이메일"
          type="email"
          autoComplete="email"
          value={email}
          error={fieldErrors.email}
          onChange={(event) => {
            setEmail(event.target.value)
            setFieldErrors((current) => ({ ...current, email: '' }))
          }}
        />
        <FormField
          id={`${mode}-password`}
          label="비밀번호"
          type="password"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          hint={isRegister ? '10~72자로 입력해 주세요.' : undefined}
          value={password}
          error={fieldErrors.password}
          onChange={(event) => {
            setPassword(event.target.value)
            setFieldErrors((current) => ({ ...current, password: '' }))
          }}
        />
        <Button type="submit" isLoading={isSubmitting} loadingLabel="확인 중">
          {isRegister ? '계정 만들기' : '로그인'}
        </Button>
      </form>
      {isRegister ? (
        <StatusNotice
          title="서비스 이용 안내"
          description="Re:Start Quest는 구직 행동 정리 도구이며 전문 상담이나 의료 서비스를 대신하지 않습니다."
        />
      ) : null}
      <AppLink to={isRegister ? '/login' : '/register'}>
        {isRegister ? '이미 계정이 있나요? 로그인' : '처음인가요? 계정 만들기'}
      </AppLink>
    </section>
  )
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { restoreError, restoreSession, status } = useAuth()
  const location = useLocationPath()

  useEffect(() => {
    if (status === 'anonymous') {
      navigate(`/login?returnTo=${encodeURIComponent(safeReturnTo(location))}`, {
        replace: true,
      })
    }
  }, [location, status])

  if (status === 'error') {
    return (
      <div>
        <StatusNotice
          tone="error"
          title="세션을 확인하지 못했어요"
          description={restoreError ?? '잠시 후 다시 시도해 주세요.'}
        />
        <Button type="button" onClick={() => void restoreSession()}>
          세션 다시 확인
        </Button>
      </div>
    )
  }

  if (status !== 'authenticated') {
    return (
      <div>
        <LoadingIndicator label="세션 확인 중" />
      </div>
    )
  }

  return children
}

function AccountPage() {
  const { logout, user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogout = async () => {
    setIsSubmitting(true)
    setError(null)
    try {
      await logout()
      navigate('/', { replace: true })
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : '로그아웃하지 못했습니다. 다시 시도해 주세요.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="hero" aria-labelledby="account-title">
      <p className="eyebrow">계정</p>
      <h1 id="account-title">내 계정</h1>
      <p>{user?.email}</p>
      {error ? (
        <StatusNotice tone="error" title="로그아웃하지 못했어요" description={error} />
      ) : null}
      <StatusNotice
        title="서비스 이용 안내"
        description="Re:Start Quest는 구직 행동 정리 도구이며 전문 상담이나 의료 서비스를 대신하지 않습니다."
      />
      <Button
        type="button"
        variant="secondary"
        isLoading={isSubmitting}
        loadingLabel="로그아웃 중"
        onClick={() => void handleLogout()}
      >
        로그아웃
      </Button>
    </section>
  )
}

function NotFoundPage() {
  return (
    <StatusNotice
      tone="error"
      title="페이지를 찾을 수 없어요"
      description="주소를 확인하거나 홈에서 다시 시작해 주세요."
    />
  )
}

export function AuthRoutes() {
  const location = useLocationPath()
  const pathname = new URL(location, window.location.origin).pathname

  if (pathname === '/') {
    return <LandingPage />
  }
  if (pathname === '/login') {
    return <AuthForm mode="login" />
  }
  if (pathname === '/register') {
    return <AuthForm mode="register" />
  }
  if (pathname === '/account') {
    return (
      <ProtectedRoute>
        <AccountPage />
      </ProtectedRoute>
    )
  }
  return <NotFoundPage />
}

export function AuthApp({ api, queryClient }: { api?: AuthApi; queryClient?: QueryClient }) {
  return (
    <AuthProvider api={api} queryClient={queryClient}>
      <AuthRoutes />
    </AuthProvider>
  )
}
