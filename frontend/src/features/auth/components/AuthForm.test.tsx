import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ApiError, getApiErrorMessage, isSessionExpired } from '../../../shared/api/ApiError'
import { AuthForm } from './AuthForm'
import { getAuthFieldErrors, validateAuthForm } from '../validation'

const submit = async () => undefined

test('회원가입 폼은 이름, 이메일, 비밀번호를 안전한 autocomplete와 함께 제공한다', () => {
  const markup = renderToStaticMarkup(
    <AuthForm
      mode="signup"
      isSubmitting={false}
      apiError={null}
      onSubmit={submit}
    />,
  )

  assert.match(markup, /이름/)
  assert.match(markup, /autocomplete="email"/i)
  assert.match(markup, /autocomplete="new-password"/i)
  assert.doesNotMatch(markup, /accessToken/i)
})

test('인증 API 오류와 제출 loading 상태를 접근 가능하게 표시한다', () => {
  const markup = renderToStaticMarkup(
    <AuthForm
      mode="login"
      isSubmitting
      apiError="이메일 또는 비밀번호를 확인해 주세요."
      onSubmit={submit}
    />,
  )

  assert.match(markup, /role="alert"/)
  assert.match(markup, /로그인하고 있어요/)
  assert.match(markup, /disabled=""/)
})

test('비밀번호는 글자 수가 아니라 UTF-8 72바이트 상한을 검증한다', () => {
  const exactLimit = validateAuthForm(
    {
      email: 'user@example.com',
      password: '가'.repeat(24),
      name: '사용자',
    },
    'signup',
  )
  const overLimit = validateAuthForm(
    {
      email: 'user@example.com',
      password: `${'가'.repeat(24)}a`,
      name: '사용자',
    },
    'signup',
  )

  assert.equal(exactLimit.password, undefined)
  assert.match(overLimit.password ?? '', /UTF-8 기준 72바이트/)
})

test('canonical INVALID_INPUT의 허용된 필드만 안전한 입력 오류로 표시한다', () => {
  const error = new ApiError(
    400,
    'INVALID_INPUT',
    'provider raw response',
    [
      { field: 'password', reason: 'stack token secret-value' },
      { field: 'accessToken', reason: 'token secret-value' },
    ],
  )
  const apiFieldErrors = getAuthFieldErrors(error, 'signup')
  const markup = renderToStaticMarkup(
    <AuthForm
      mode="signup"
      isSubmitting={false}
      apiError={getApiErrorMessage(error)}
      apiFieldErrors={apiFieldErrors}
      onSubmit={submit}
    />,
  )

  assert.deepEqual(Object.keys(apiFieldErrors), ['password'])
  assert.match(markup, /aria-describedby="password-error"/)
  assert.match(markup, /UTF-8 기준 72바이트/)
  assert.doesNotMatch(
    markup,
    /provider raw response|stack token secret-value|token secret-value|accessToken/i,
  )
})

test('401과 403은 세션 만료로 분류하면서 서버 원문을 표시하지 않는다', () => {
  for (const status of [401, 403]) {
    const error = new ApiError(
      status,
      'UNAUTHORIZED',
      'token secret-value provider stack',
    )

    assert.equal(isSessionExpired(error), true)
    assert.doesNotMatch(getApiErrorMessage(error), /token|provider|stack|secret/i)
  }
})
