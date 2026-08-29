import { readFile } from 'node:fs/promises'
import path from 'node:path'

const BROWSER_TIMEOUT_MS = 15_000

function objectValue(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseActivePort(contents) {
  const [portText] = contents.trim().split(/\r?\n/)
  const port = Number.parseInt(portText, 10)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('DevToolsActivePort에 유효한 포트가 없습니다.')
  }
  return port
}

function websocketUrl(value, port, field) {
  if (typeof value !== 'string') {
    throw new Error(`${field} schema가 문자열이 아닙니다.`)
  }
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`${field} schema가 유효한 URL이 아닙니다.`)
  }
  if (
    parsed.protocol !== 'ws:' ||
    !['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
    parsed.port !== String(port)
  ) {
    throw new Error(
      `${field}가 선택된 로컬 DevTools endpoint를 가리키지 않습니다.`,
    )
  }
  return value
}

async function endpointJson(pathname, port, fetchImpl, signal) {
  let response
  try {
    response = await fetchImpl(`http://127.0.0.1:${port}${pathname}`, { signal })
  } catch (error) {
    if (signal?.aborted) {
      throw new Error(`${pathname} 요청이 제한 시간 안에 완료되지 않았습니다.`, {
        cause: error,
      })
    }
    throw new Error(
      `${pathname} 요청에 실패했습니다: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    )
  }
  if (!response.ok) {
    throw new Error(`${pathname} HTTP 상태가 ${response.status}입니다.`)
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(`${pathname} Content-Type이 JSON이 아닙니다.`)
  }
  try {
    return await response.json()
  } catch (error) {
    throw new Error(`${pathname} 응답이 유효한 JSON이 아닙니다.`, {
      cause: error,
    })
  }
}

export async function readDevToolsEndpoints(
  port,
  fetchImpl = fetch,
  signal,
) {
  const version = await endpointJson('/json/version', port, fetchImpl, signal)
  if (
    !objectValue(version) ||
    typeof version.Browser !== 'string' ||
    typeof version['Protocol-Version'] !== 'string'
  ) {
    throw new Error('/json/version 응답 schema가 올바르지 않습니다.')
  }
  websocketUrl(
    version.webSocketDebuggerUrl,
    port,
    '/json/version.webSocketDebuggerUrl',
  )

  const targets = await endpointJson('/json/list', port, fetchImpl, signal)
  if (!Array.isArray(targets) || targets.some((target) => !objectValue(target))) {
    throw new Error('/json/list 응답 schema가 배열이 아닙니다.')
  }
  const page = targets.find((target) => target.type === 'page')
  if (
    !page ||
    typeof page.id !== 'string' ||
    typeof page.url !== 'string'
  ) {
    throw new Error('/json/list에 유효한 page target이 없습니다.')
  }
  return websocketUrl(
    page.webSocketDebuggerUrl,
    port,
    '/json/list.page.webSocketDebuggerUrl',
  )
}

function childFailure(state) {
  if (state.spawnError) {
    return new Error(`headless browser spawn에 실패했습니다: ${state.spawnError.message}`, {
      cause: state.spawnError,
    })
  }
  if (state.exitCode !== null || state.signal !== null) {
    return new Error(
      'headless browser가 DevTools 준비 전에 종료되었습니다: ' +
        `exitCode=${state.exitCode ?? '<none>'}, ` +
        `signal=${state.signal ?? '<none>'}`,
    )
  }
  return null
}

async function discoverPage({ profileDirectory, readFileImpl, fetchImpl, signal }) {
  let activePort
  try {
    activePort = await readFileImpl(
      path.join(profileDirectory, 'DevToolsActivePort'),
      'utf8',
    )
  } catch (error) {
    throw new Error('DevToolsActivePort를 아직 읽을 수 없습니다.', { cause: error })
  }
  const port = parseActivePort(activePort)
  return readDevToolsEndpoints(port, fetchImpl, signal)
}

export async function waitForDevTools({
  profileDirectory,
  childState,
  getRuntimeFailure = () => null,
  readFileImpl = readFile,
  fetchImpl = fetch,
  timeoutMs = BROWSER_TIMEOUT_MS,
  requestTimeoutMs = 1_000,
  pollIntervalMs = 100,
  now = Date.now,
  sleep = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
}) {
  const deadline = now() + timeoutMs
  let lastEndpointError = null
  while (now() < deadline) {
    const failure = childFailure(childState) ?? getRuntimeFailure()
    if (failure) throw failure

    const controller = new AbortController()
    const remainingMs = Math.max(1, deadline - now())
    const requestTimeout = setTimeout(
      () => controller.abort(),
      Math.min(requestTimeoutMs, remainingMs),
    )
    try {
      return await discoverPage({
        profileDirectory,
        readFileImpl,
        fetchImpl,
        signal: controller.signal,
      })
    } catch (error) {
      lastEndpointError = error
    } finally {
      clearTimeout(requestTimeout)
    }
    await sleep(pollIntervalMs)
  }

  const failure = childFailure(childState) ?? getRuntimeFailure()
  if (failure) throw failure
  throw new Error(
    'headless browser DevTools 준비 시간이 초과되었습니다. ' +
      `마지막 endpoint 오류: ${lastEndpointError?.message ?? '<none>'}`,
    { cause: lastEndpointError ?? undefined },
  )
}
