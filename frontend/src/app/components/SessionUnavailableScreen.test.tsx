import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { SessionUnavailableScreen } from './SessionUnavailableScreen'

test('세션 조회 장애는 로그인 정보를 보존하고 재시도할 수 있음을 안내한다', () => {
  const markup = renderToStaticMarkup(
    <SessionUnavailableScreen onRetry={() => undefined} />,
  )

  assert.match(markup, /role="alert"/)
  assert.match(markup, /로그인 정보는 그대로 보관했습니다/)
  assert.match(markup, /다시 연결하기/)
})
