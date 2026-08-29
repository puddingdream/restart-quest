import { spawn as nodeSpawn } from 'node:child_process'
import { constants } from 'node:fs'
import { access, mkdtemp, realpath, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const OUTPUT_LIMIT_BYTES = 4_096
const PROFILE_REMOVE_MAX_RETRIES = 5
const PROFILE_REMOVE_RETRY_DELAY_MS = 200

function nestedPath(root, ...parts) {
  return root ? path.join(root, ...parts) : undefined
}

function normalizedExecutable(value) {
  const candidate = value?.trim()
  if (!candidate) return undefined
  return candidate.startsWith('"') && candidate.endsWith('"')
    ? candidate.slice(1, -1)
    : candidate
}

export function browserExecutableCandidates({
  platform = process.platform,
  env = process.env,
} = {}) {
  const explicit = [
    { source: 'E2E_BROWSER_PATH', executable: env.E2E_BROWSER_PATH },
    { source: 'CHROME_PATH', executable: env.CHROME_PATH },
    { source: 'CHROME_BIN', executable: env.CHROME_BIN },
  ]
  if (platform === 'win32') {
    return [
      ...explicit,
      {
        source: 'windows-program-files-chrome',
        executable: nestedPath(
          env.ProgramFiles,
          'Google',
          'Chrome',
          'Application',
          'chrome.exe',
        ),
      },
      {
        source: 'windows-program-files-edge',
        executable: nestedPath(
          env.ProgramFiles,
          'Microsoft',
          'Edge',
          'Application',
          'msedge.exe',
        ),
      },
      {
        source: 'windows-x86-chrome',
        executable: nestedPath(
          env['ProgramFiles(x86)'],
          'Google',
          'Chrome',
          'Application',
          'chrome.exe',
        ),
      },
      {
        source: 'windows-x86-edge',
        executable: nestedPath(
          env['ProgramFiles(x86)'],
          'Microsoft',
          'Edge',
          'Application',
          'msedge.exe',
        ),
      },
      {
        source: 'windows-local-chrome',
        executable: nestedPath(
          env.LOCALAPPDATA,
          'Google',
          'Chrome',
          'Application',
          'chrome.exe',
        ),
      },
      {
        source: 'windows-local-edge',
        executable: nestedPath(
          env.LOCALAPPDATA,
          'Microsoft',
          'Edge',
          'Application',
          'msedge.exe',
        ),
      },
    ]
  }
  if (platform === 'darwin') {
    return [
      ...explicit,
      {
        source: 'macos-google-chrome',
        executable:
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      },
      {
        source: 'macos-chromium',
        executable: '/Applications/Chromium.app/Contents/MacOS/Chromium',
      },
      {
        source: 'macos-edge',
        executable:
          '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      },
    ]
  }
  return [
    ...explicit,
    {
      source: 'linux-google-chrome-stable',
      executable: '/usr/bin/google-chrome-stable',
    },
    { source: 'linux-google-chrome', executable: '/usr/bin/google-chrome' },
    { source: 'linux-chromium', executable: '/usr/bin/chromium' },
    { source: 'linux-chromium-browser', executable: '/usr/bin/chromium-browser' },
    { source: 'linux-edge', executable: '/usr/bin/microsoft-edge' },
  ]
}

export async function selectBrowserExecutable({
  platform = process.platform,
  env = process.env,
  accessFile = access,
  statFile = stat,
} = {}) {
  const checked = []
  for (const candidate of browserExecutableCandidates({ platform, env })) {
    const executable = normalizedExecutable(candidate.executable)
    if (!executable) {
      checked.push({ source: candidate.source, result: 'unset' })
      continue
    }
    try {
      if (!(await statFile(executable)).isFile()) throw new Error('not a file')
      await accessFile(executable, constants.X_OK)
      checked.push({ source: candidate.source, result: 'selected' })
      return { source: candidate.source, executable, checked }
    } catch {
      checked.push({ source: candidate.source, result: 'unavailable' })
    }
  }
  throw new Error(
    'Chrome, Chromium 또는 Edge 실행 파일을 찾지 못했습니다. ' +
      `확인한 후보: ${checked
        .map(({ source, result }) => `${source}=${result}`)
        .join(', ')}. E2E_BROWSER_PATH를 지정해 주세요.`,
  )
}

function enabled(value) {
  return value === '1' || value?.toLowerCase() === 'true'
}

export function browserLaunchArgs({
  platform = process.platform,
  env = process.env,
  profileDirectory,
}) {
  const isAbsolute =
    platform === 'win32'
      ? path.win32.isAbsolute(profileDirectory)
      : path.posix.isAbsolute(profileDirectory)
  if (!isAbsolute) {
    throw new Error('browser 임시 profile 경로는 절대 경로여야 합니다.')
  }
  const platformArgs = []
  if (platform === 'linux') {
    platformArgs.push('--disable-dev-shm-usage')
    if (enabled(env.CI) || enabled(env.E2E_BROWSER_NO_SANDBOX)) {
      platformArgs.push('--no-sandbox')
    }
  } else if (platform === 'win32') {
    platformArgs.push('--disable-features=CalculateNativeWinOcclusion')
  }
  return [
    '--headless=new',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${profileDirectory}`,
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=0',
    '--window-size=1440,1000',
    ...platformArgs,
    'about:blank',
  ]
}

export async function createBrowserProfile({
  tempRoot = os.tmpdir(),
  createTemporaryDirectory = mkdtemp,
  canonicalize = realpath,
  statDirectory = stat,
  removeDirectory = removeBrowserProfile,
} = {}) {
  let createdDirectory
  try {
    createdDirectory = await createTemporaryDirectory(
      path.join(tempRoot, 'restart-quest-e2e-'),
    )
    const profileDirectory = await canonicalize(createdDirectory)
    if (!path.isAbsolute(profileDirectory)) {
      throw new Error('browser 임시 profile의 canonical 경로가 절대 경로가 아닙니다.')
    }
    if (!(await statDirectory(profileDirectory)).isDirectory()) {
      throw new Error('browser 임시 profile이 디렉터리가 아닙니다.')
    }
    return profileDirectory
  } catch (error) {
    if (createdDirectory) await removeDirectory(createdDirectory)
    throw error
  }
}

export function redactBrowserOutput(value) {
  return value
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+/gi, '$1<redacted>')
    .replace(
      /((?:authorization|api[_-]?key|password|secret|token)\s*[:=]\s*)[^\s,;]+/gi,
      '$1<redacted>',
    )
    .replace(/(https?:\/\/[^\s?]+)\?[^\s]*/gi, '$1?<redacted>')
}

export function createBoundedOutputCollector(limitBytes = OUTPUT_LIMIT_BYTES) {
  let buffer = Buffer.alloc(0)
  return {
    append(chunk) {
      const next = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
      buffer = Buffer.concat([buffer, next])
      if (buffer.byteLength > limitBytes) {
        buffer = Buffer.from(buffer.subarray(buffer.byteLength - limitBytes))
      }
    },
    read() {
      return redactBrowserOutput(buffer.toString('utf8')).trim() || '<empty>'
    },
  }
}

export function spawnBrowserProcess(
  executable,
  args,
  { platform = process.platform, spawnImpl = nodeSpawn } = {},
) {
  const child = spawnImpl(executable, args, {
    detached: platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  const stdout = createBoundedOutputCollector()
  const stderr = createBoundedOutputCollector()
  child.stdout?.on('data', (chunk) => stdout.append(chunk))
  child.stderr?.on('data', (chunk) => stderr.append(chunk))
  const state = {
    spawnError: null,
    exitCode: child.exitCode ?? null,
    signal: child.signalCode ?? null,
  }
  child.once('error', (error) => {
    state.spawnError = error
  })
  child.once('exit', (code, signal) => {
    state.exitCode = code
    state.signal = signal
  })
  return { child, stdout, stderr, state }
}

export function redactBrowserArgs(args) {
  return args.map((argument) =>
    argument.startsWith('--user-data-dir=')
      ? '--user-data-dir=<temporary-profile>'
      : argument,
  )
}

export function browserProcessDiagnostics({
  platform,
  selection,
  args,
  profileDirectory,
  stdout,
  stderr,
  state,
}) {
  const sanitize = (value) =>
    profileDirectory
      ? value.split(profileDirectory).join('<temporary-profile>')
      : value
  const spawnError = state?.spawnError
    ? sanitize(redactBrowserOutput(state.spawnError.message))
    : '<none>'
  return [
    `platform=${platform}`,
    `executable=${selection.source} (${path.basename(selection.executable)})`,
    `candidates=${selection.checked
      .map(({ source, result }) => `${source}:${result}`)
      .join(',')}`,
    `args=${redactBrowserArgs(args).join(' ')}`,
    'profile=created,canonical,temporary',
    `exitCode=${state?.exitCode ?? '<running>'}`,
    `signal=${state?.signal ?? '<none>'}`,
    `spawnError=${spawnError}`,
    `stdout=${sanitize(stdout?.read() ?? '<unavailable>')}`,
    `stderr=${sanitize(stderr?.read() ?? '<unavailable>')}`,
  ].join('\n')
}

export function browserRuntimeFailure(stderr) {
  const output = stderr?.read() ?? ''
  if (output.includes('DevTools remote debugging requires a non-default data directory')) {
    return new Error(
      'Chrome이 검증된 임시 user-data-dir를 적용하지 않고 remote debugging을 거부했습니다. ' +
        'Chrome for Testing 또는 runner가 허용한 E2E_BROWSER_PATH를 확인해 주세요.',
    )
  }
  if (output.includes('DevTools remote debugging is disallowed by the system admin')) {
    return new Error('runner 정책이 Chrome remote debugging을 허용하지 않습니다.')
  }
  return null
}

export function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve(true)
  }
  return new Promise((resolve) => {
    const onExit = () => {
      clearTimeout(timeout)
      resolve(true)
    }
    const timeout = setTimeout(() => {
      child.off('exit', onExit)
      resolve(false)
    }, timeoutMs)
    child.once('exit', onExit)
    if (child.exitCode !== null || child.signalCode !== null) onExit()
  })
}

function runWindowsTreeKill(child, spawnImpl) {
  return new Promise((resolve, reject) => {
    const killer = spawnImpl(
      'taskkill.exe',
      ['/pid', String(child.pid), '/t', '/f'],
      { stdio: 'ignore', windowsHide: true },
    )
    killer.once('error', reject)
    killer.once('exit', (code) => {
      resolve(code)
    })
  })
}

export async function terminateBrowserProcessTree(
  child,
  {
    platform = process.platform,
    spawnImpl = nodeSpawn,
    killImpl = process.kill,
    waitForExitImpl = waitForExit,
  } = {},
) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  if (!child.pid) return
  if (platform === 'win32') {
    const taskkillExitCode = await runWindowsTreeKill(child, spawnImpl)
    const exited = await waitForExitImpl(child, 2_000)
    if (exited || child.exitCode !== null || child.signalCode !== null) return
    if (taskkillExitCode !== 0) {
      throw new Error(
        `taskkill이 종료 코드 ${taskkillExitCode}로 끝났고 browser process tree(PID ${child.pid}) 종료를 확인하지 못했습니다.`,
      )
    }
    throw new Error(
      `browser process tree(PID ${child.pid}) 종료를 확인하지 못했습니다.`,
    )
  }
  try {
    killImpl(-child.pid, 'SIGTERM')
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error
  }
  if (await waitForExitImpl(child, 2_000)) return
  try {
    killImpl(-child.pid, 'SIGKILL')
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error
  }
  if (!(await waitForExitImpl(child, 2_000))) {
    throw new Error(
      `browser process group(PID ${child.pid}) 종료를 확인하지 못했습니다.`,
    )
  }
}

export function removeBrowserProfile(profileDirectory) {
  return rm(profileDirectory, {
    recursive: true,
    force: true,
    maxRetries: PROFILE_REMOVE_MAX_RETRIES,
    retryDelay: PROFILE_REMOVE_RETRY_DELAY_MS,
  })
}

export async function cleanupBrowserResources({
  child,
  profileDirectory,
  terminate = terminateBrowserProcessTree,
  removeProfile = removeBrowserProfile,
}) {
  const errors = []
  try {
    await terminate(child)
  } catch (error) {
    errors.push(error)
  }
  try {
    if (profileDirectory) await removeProfile(profileDirectory)
  } catch (error) {
    errors.push(error)
  }
  if (errors.length === 1) throw errors[0]
  if (errors.length > 1) {
    throw new AggregateError(
      errors,
      'browser process tree와 임시 profile 정리에 실패했습니다.',
    )
  }
}

export function combinePrimaryAndCleanup(primary, cleanup) {
  const normalizedPrimary =
    primary instanceof Error ? primary : new Error(String(primary))
  if (!cleanup) return normalizedPrimary
  const cleanupErrors =
    cleanup instanceof AggregateError ? cleanup.errors : [cleanup]
  return new AggregateError(
    [normalizedPrimary, ...cleanupErrors],
    `${normalizedPrimary.message} 또한 browser 정리 중 오류가 발생했습니다.`,
  )
}
