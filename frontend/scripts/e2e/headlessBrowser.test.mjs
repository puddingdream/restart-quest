import assert from 'node:assert/strict'
import test from 'node:test'
import {
  browserLaunchArgs,
  removeBrowserProfile,
  requestBrowserShutdown,
} from './headlessBrowser.mjs'

test('browser profile의 spellcheck 잠금을 만들지 않는 전용 launch args를 사용한다', () => {
  const args = browserLaunchArgs(9333, 'C:\\temp\\restart-quest-e2e-profile')

  assert.ok(args.includes('--disable-spell-checking'))
  assert.ok(args.includes('--remote-debugging-port=9333'))
  assert.ok(
    args.includes(
      '--user-data-dir=C:\\temp\\restart-quest-e2e-profile',
    ),
  )
})

test('Windows의 지연된 EBUSY 해제를 기다리는 bounded profile 삭제 옵션을 사용한다', async () => {
  let observedPath
  let observedOptions

  await removeBrowserProfile('temporary-profile', async (profilePath, options) => {
    observedPath = profilePath
    observedOptions = options
  })

  assert.equal(observedPath, 'temporary-profile')
  assert.deepEqual(observedOptions, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 250,
  })
})

test('강제 종료 전에 CDP Browser.close로 profile handle 해제를 요청한다', async () => {
  const calls = []
  const page = {
    async send(method) {
      calls.push(method)
    },
    close() {
      calls.push('socket.close')
    },
  }

  await requestBrowserShutdown(page)

  assert.deepEqual(calls, ['Browser.close', 'socket.close'])
})

test('CDP close가 실패해도 socket을 닫고 강제 종료 fallback을 계속할 수 있다', async () => {
  let socketClosed = false
  const page = {
    async send() {
      throw new Error('browser already closing')
    },
    close() {
      socketClosed = true
    },
  }

  await requestBrowserShutdown(page)

  assert.equal(socketClosed, true)
})
