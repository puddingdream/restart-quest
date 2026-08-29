import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { access } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  browserLaunchArgs,
  browserProcessDiagnostics,
  browserRuntimeFailure,
  cleanupBrowserResources,
  combinePrimaryAndCleanup,
  createBoundedOutputCollector,
  createBrowserProfile,
  redactBrowserArgs,
  removeBrowserProfile,
  selectBrowserExecutable,
  terminateBrowserProcessTree,
} from './browserProcess.mjs'
import {
  parseActivePort,
  readDevToolsEndpoints,
  waitForDevTools,
} from './devToolsEndpoint.mjs'
import { launchBrowser } from './headlessBrowser.mjs'

const selection = {
  source: 'E2E_BROWSER_PATH',
  executable: path.resolve('browser', 'chrome'),
  checked: [{ source: 'E2E_BROWSER_PATH', result: 'selected' }],
}

function jsonResponse(value, status = 200, contentType = 'application/json') {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': contentType },
  })
}

function processInfo() {
  return {
    child: { pid: 321, exitCode: null, signalCode: null },
    state: { spawnError: null, exitCode: null, signal: null },
    stdout: { read: () => '<empty>' },
    stderr: { read: () => '<empty>' },
  }
}

test('실행 파일 후보의 출처와 최종 선택 근거를 보존한다', async () => {
  const result = await selectBrowserExecutable({
    platform: 'linux',
    env: { E2E_BROWSER_PATH: '/missing', CHROME_PATH: ' "/chosen" ' },
    statFile: async (candidate) => ({ isFile: () => candidate === '/chosen' }),
    accessFile: async (candidate) => {
      if (candidate !== '/chosen') throw new Error('missing')
    },
  })
  assert.equal(result.executable, '/chosen')
  assert.deepEqual(result.checked.slice(0, 2), [
    { source: 'E2E_BROWSER_PATH', result: 'unavailable' },
    { source: 'CHROME_PATH', result: 'selected' },
  ])
})

test('임시 profile을 canonical 절대 디렉터리로 만든다', async () => {
  const profileDirectory = await createBrowserProfile()
  try {
    assert.equal(path.isAbsolute(profileDirectory), true)
    await access(profileDirectory)
  } finally {
    await removeBrowserProfile(profileDirectory)
  }
})

test('launch args는 검증된 profile과 동적 DevTools port를 사용한다', () => {
  const profileDirectory =
    process.platform === 'win32' ? 'C:\\temp\\profile' : '/tmp/profile'
  const args = browserLaunchArgs({
    platform: process.platform,
    env: {},
    profileDirectory,
  })
  const profileIndex = args.indexOf(`--user-data-dir=${profileDirectory}`)
  const debuggingIndex = args.indexOf('--remote-debugging-port=0')
  assert.ok(profileIndex >= 0)
  assert.ok(debuggingIndex > profileIndex)
  assert.equal(args.some((argument) => /^--remote-debugging-port=\d+$/.test(argument) && argument !== '--remote-debugging-port=0'), false)
  assert.equal(
    redactBrowserArgs(args)[profileIndex],
    '--user-data-dir=<temporary-profile>',
  )
})

test('DevToolsActivePort와 version/list schema로 page endpoint를 찾는다', async () => {
  const port = parseActivePort('9333\n/devtools/browser/browser-id\n')
  const endpoint = await readDevToolsEndpoints(port, async (url) => {
    if (url.endsWith('/json/version')) {
      return jsonResponse({
        Browser: 'Chrome/151',
        'Protocol-Version': '1.3',
        webSocketDebuggerUrl:
          `ws://127.0.0.1:${port}/devtools/browser/browser-id`,
      })
    }
    return jsonResponse([
      {
        id: 'page-id',
        type: 'page',
        url: 'about:blank',
        webSocketDebuggerUrl:
          `ws://127.0.0.1:${port}/devtools/page/page-id`,
      },
    ])
  })
  assert.equal(endpoint, `ws://127.0.0.1:${port}/devtools/page/page-id`)
})

test('DevTools endpoint의 malformed port, HTTP, JSON, schema를 구분한다', async () => {
  assert.throws(() => parseActivePort('not-a-port'), /유효한 포트/)
  await assert.rejects(
    readDevToolsEndpoints(9333, async () => jsonResponse({}, 503)),
    /HTTP 상태가 503/,
  )
  await assert.rejects(
    readDevToolsEndpoints(
      9333,
      async () => new Response('{broken', {
        headers: { 'content-type': 'application/json' },
      }),
    ),
    /유효한 JSON/,
  )
  await assert.rejects(
    readDevToolsEndpoints(9333, async () => jsonResponse({ Browser: 'Chrome' })),
    /schema/,
  )
})

test('spawn 실패와 browser 조기 종료를 timeout 전에 보고한다', async () => {
  await assert.rejects(
    waitForDevTools({
      profileDirectory: path.resolve('profile'),
      childState: {
        spawnError: new Error('spawn EACCES'),
        exitCode: null,
        signal: null,
      },
    }),
    /spawn EACCES/,
  )
  await assert.rejects(
    waitForDevTools({
      profileDirectory: path.resolve('profile'),
      childState: { spawnError: null, exitCode: 17, signal: 'SIGABRT' },
    }),
    /exitCode=17, signal=SIGABRT/,
  )
})

test('endpoint timeout은 마지막 탐지 오류를 보존한다', async () => {
  let time = 0
  await assert.rejects(
    waitForDevTools({
      profileDirectory: path.resolve('profile'),
      childState: { spawnError: null, exitCode: null, signal: null },
      readFileImpl: async () => {
        throw new Error('missing')
      },
      timeoutMs: 10,
      pollIntervalMs: 5,
      now: () => time,
      sleep: async (milliseconds) => {
        time += milliseconds
      },
    }),
    /마지막 endpoint 오류: DevToolsActivePort를 아직 읽을 수 없습니다/,
  )
})

test('Chrome 기본 profile 거부 진단을 timeout과 구분한다', () => {
  const failure = browserRuntimeFailure({
    read: () =>
      'DevTools remote debugging requires a non-default data directory. ' +
      'Specify this using --user-data-dir.',
  })
  assert.match(failure.message, /임시 user-data-dir/)
  assert.match(failure.message, /Chrome for Testing/)
})

test('child 출력 진단은 크기를 제한하고 secret과 query를 가린다', () => {
  const output = createBoundedOutputCollector(180)
  output.append('x'.repeat(300))
  output.append(
    ' token=secret-value Authorization=Bearer abc.def ' +
      'https://host/path?token=secret',
  )
  const diagnostic = output.read()
  assert.ok(Buffer.byteLength(diagnostic) <= 220)
  assert.doesNotMatch(diagnostic, /secret-value|abc\.def|token=secret$/)
  assert.match(diagnostic, /<redacted>/)

  const profileDirectory = path.resolve('private-profile-path')
  const diagnostics = browserProcessDiagnostics({
    platform: process.platform,
    selection,
    args: browserLaunchArgs({
      platform: process.platform,
      env: {},
      profileDirectory,
    }),
    profileDirectory,
    stdout: { read: () => profileDirectory },
    stderr: { read: () => profileDirectory },
    state: { spawnError: null, exitCode: null, signal: null },
  })
  assert.equal(diagnostics.includes(profileDirectory), false)
  assert.match(diagnostics, /<temporary-profile>/)
})

test('launch는 profile 생성 후 정확한 args를 spawn하고 성공 stop에서 정리한다', async () => {
  const profileDirectory = path.resolve(os.tmpdir(), 'profile-under-test')
  const info = processInfo()
  let spawnedArgs
  const cleaned = []
  const browser = await launchBrowser({
    platform: process.platform,
    env: {},
    selectExecutable: async () => selection,
    createProfile: async () => profileDirectory,
    spawnProcess: (_executable, args) => {
      spawnedArgs = args
      return info
    },
    awaitDevTools: async ({ profileDirectory: observedProfile }) => {
      assert.equal(observedProfile, profileDirectory)
      return 'ws://127.0.0.1:9333/devtools/page/page-id'
    },
    createPage: () => ({
      async connect() {},
      async setViewport() {},
      close() {},
    }),
    cleanup: async (resources) => cleaned.push(resources),
    logger: { info() {} },
  })
  assert.ok(spawnedArgs.includes(`--user-data-dir=${profileDirectory}`))
  assert.ok(spawnedArgs.includes('--remote-debugging-port=0'))
  await browser.stop()
  await browser.stop()
  assert.deepEqual(cleaned, [
    { child: info.child, profileDirectory },
  ])
})

test('spawn, endpoint와 cleanup 실패에서 전용 resource 정리를 모두 시도한다', async () => {
  const profileDirectory = path.resolve(os.tmpdir(), 'profile-under-test')
  const cleaned = []
  const common = {
    platform: process.platform,
    env: {},
    selectExecutable: async () => selection,
    createProfile: async () => profileDirectory,
    logger: { info() {} },
    cleanup: async (resources) => cleaned.push(resources),
  }
  await assert.rejects(
    launchBrowser({
      ...common,
      spawnProcess: () => {
        throw new Error('spawn denied')
      },
    }),
    (error) => /spawn denied/.test(error.message) && /profile=created/.test(error.message),
  )
  const info = processInfo()
  await assert.rejects(
    launchBrowser({
      ...common,
      spawnProcess: () => info,
      awaitDevTools: async () => {
        throw new Error('invalid endpoint')
      },
    }),
    /invalid endpoint/,
  )
  assert.deepEqual(cleaned, [
    { child: undefined, profileDirectory },
    { child: info.child, profileDirectory },
  ])

  const calls = []
  await assert.rejects(
    cleanupBrowserResources({
      child: { pid: 1 },
      profileDirectory,
      terminate: async () => {
        calls.push('terminate')
        throw new Error('terminate error')
      },
      removeProfile: async () => {
        calls.push('profile')
        throw new Error('remove error')
      },
    }),
    (error) => error instanceof AggregateError && error.errors.length === 2,
  )
  assert.deepEqual(calls, ['terminate', 'profile'])
})

test('Windows 종료는 helper가 만든 PID tree에만 taskkill /t를 사용한다', async () => {
  const killer = new EventEmitter()
  let windowsCommand
  const child = { pid: 42, exitCode: null, signalCode: null }
  await terminateBrowserProcessTree(child, {
    platform: 'win32',
    spawnImpl(executable, args) {
      windowsCommand = [executable, ...args]
      queueMicrotask(() => killer.emit('exit', 0))
      return killer
    },
    waitForExitImpl: async () => true,
  })
  assert.deepEqual(windowsCommand, [
    'taskkill.exe',
    '/pid',
    '42',
    '/t',
    '/f',
  ])
})

test('Windows taskkill 255는 child 종료가 확인된 경합일 때만 성공한다', async () => {
  const exitedKiller = new EventEmitter()
  const exitedChild = Object.assign(new EventEmitter(), {
    pid: 43,
    exitCode: null,
    signalCode: null,
  })
  await terminateBrowserProcessTree(exitedChild, {
    platform: 'win32',
    spawnImpl() {
      queueMicrotask(() => {
        exitedChild.exitCode = 0
        exitedKiller.emit('exit', 255)
      })
      return exitedKiller
    },
  })

  const runningKiller = new EventEmitter()
  await assert.rejects(
    terminateBrowserProcessTree(
      { pid: 44, exitCode: null, signalCode: null },
      {
        platform: 'win32',
        spawnImpl() {
          queueMicrotask(() => runningKiller.emit('exit', 255))
          return runningKiller
        },
        waitForExitImpl: async () => false,
      },
    ),
    /종료 코드 255.*종료를 확인하지 못했습니다/,
  )
})

test('primary E2E 오류를 cleanup 오류보다 앞선 원인으로 보존한다', () => {
  const primary = new Error('오늘 퀘스트 이동 확인 시간이 초과되었습니다.')
  const cleanup = new Error('taskkill이 종료 코드 255로 끝났습니다.')
  const combined = combinePrimaryAndCleanup(primary, cleanup)

  assert.equal(combined instanceof AggregateError, true)
  assert.equal(combined.errors[0], primary)
  assert.equal(combined.errors[1], cleanup)
  assert.match(combined.message, /^오늘 퀘스트 이동 확인 시간이 초과되었습니다/)
})
