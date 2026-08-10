import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import test from 'node:test'
import { CdpPage, runRequiredBrowserFlow } from './headlessBrowser.mjs'
import { ensureBackendReady } from './localStack.mjs'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

test('build 명령은 운영체제별 esbuild 실행 파일을 npm PATH에서 선택한다', async () => {
  const packageJson = JSON.parse(await readFile(path.join(frontendRoot, 'package.json'), 'utf8'))

  assert.match(packageJson.scripts.build, /&& esbuild /)
  assert.doesNotMatch(packageJson.scripts.build, /win32|esbuild\.exe/)
  assert.equal(packageJson.devDependencies.esbuild, '0.25.12')
})

test('브라우저 시작 실패는 UI E2E 실패로 전파된다', async () => {
  const launchError = new Error('브라우저 시작 실패')
  let flowCalled = false

  await assert.rejects(
    runRequiredBrowserFlow(
      async () => { flowCalled = true },
      'http://127.0.0.1',
      async () => { throw launchError },
    ),
    (error) => error === launchError,
  )
  assert.equal(flowCalled, false)
})

test('브라우저 흐름 실패 시 시작된 브라우저를 정리한다', async () => {
  const flowError = new Error('브라우저 흐름 실패')
  let stopped = false
  const browser = {
    page: {},
    stop: async () => { stopped = true },
  }

  await assert.rejects(
    runRequiredBrowserFlow(async () => { throw flowError }, 'http://127.0.0.1', async () => browser),
    (error) => error === flowError,
  )
  assert.equal(stopped, true)
})

test('backend readiness 실패 시 시작된 자식 프로세스를 종료한다', async () => {
  const readinessError = new Error('readiness 실패')
  const child = new EventEmitter()
  child.exitCode = null
  child.killCalls = []
  child.kill = (signal) => {
    child.killCalls.push(signal)
    queueMicrotask(() => {
      child.exitCode = 0
      child.emit('exit', 0, signal)
    })
    return true
  }

  await assert.rejects(
    ensureBackendReady('http://127.0.0.1', child, async () => { throw readinessError }),
    (error) => error === readinessError,
  )
  assert.deepEqual(child.killCalls, [undefined])
  assert.equal(child.exitCode, 0)
})

class FakeSocket extends EventTarget {
  send() {}
  close() {
    this.dispatchEvent(new Event('close'))
  }
}

for (const eventType of ['close', 'error']) {
  test(`CDP ${eventType} 이벤트는 대기 중인 모든 명령을 거부하고 정리한다`, async () => {
    const socket = new FakeSocket()
    const page = new CdpPage('ws://example.test', () => socket)
    const first = page.send('Runtime.evaluate')
    const second = page.send('Page.navigate')

    socket.dispatchEvent(new Event(eventType))

    await assert.rejects(first, /DevTools WebSocket/)
    await assert.rejects(second, /DevTools WebSocket/)
    assert.equal(page.pending.size, 0)
    await assert.rejects(page.send('Page.reload'), /DevTools WebSocket/)
  })
}
