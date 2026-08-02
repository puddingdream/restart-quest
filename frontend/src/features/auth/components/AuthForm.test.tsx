import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { AuthForm } from './AuthForm'

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
