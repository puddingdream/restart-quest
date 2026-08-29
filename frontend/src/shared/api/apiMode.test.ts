import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { resolveApiMode } from './apiMode'
import { createApiUrl } from './apiUrl'

test('API mode 미지정과 알 수 없는 값은 HTTP를 사용한다', () => {
  assert.equal(resolveApiMode(undefined, undefined), 'http')
  assert.equal(resolveApiMode(undefined, 'unexpected'), 'http')
  assert.equal(resolveApiMode('', 'mock'), 'http')
  assert.equal(resolveApiMode('unexpected', 'mock'), 'http')
  assert.equal(resolveApiMode('http', 'mock'), 'http')
})

test('mock은 환경 또는 문서에서 정확히 명시한 경우에만 사용한다', () => {
  assert.equal(resolveApiMode('mock', 'http'), 'mock')
  assert.equal(resolveApiMode(undefined, 'mock'), 'mock')
  assert.equal(resolveApiMode('MOCK', 'mock'), 'http')
})

test('기본 dev와 build 진입 문서는 /api/v1 HTTP 경계를 우회하지 않는다', async () => {
  const indexHtml = await readFile(path.resolve(process.cwd(), 'index.html'), 'utf8')

  assert.equal(createApiUrl('/auth/signup', undefined), '/api/v1/auth/signup')
  assert.equal(
    createApiUrl('/users/me', 'https://example.test/'),
    'https://example.test/api/v1/users/me',
  )
  assert.match(
    indexHtml,
    /<meta name="restart-quest-api-mode" content="http" \/>/,
  )
  assert.doesNotMatch(
    indexHtml,
    /<meta name="restart-quest-api-mode" content="mock" \/>/,
  )
})
