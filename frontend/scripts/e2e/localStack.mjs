import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const READY_TIMEOUT_MS = 45_000
const STOP_TIMEOUT_MS = 5_000

export async function getFreePort() {
  const server = createServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('포트를 확보하지 못했습니다.')
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
  return address.port
}

function commandFor(executable, args) {
  if (process.platform !== 'win32') return { executable, args }
  return {
    executable: 'cmd.exe',
    args: ['/d', '/s', '/c', executable, ...args],
  }
}

export async function runCommand(executable, args, options = {}) {
  const command = commandFor(executable, args)
  await new Promise((resolve, reject) => {
    const child = spawn(command.executable, command.args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: 'inherit',
    })
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${path.basename(executable)} 명령이 종료 코드 ${code}로 끝났습니다.`))
    })
  })
}

async function waitForBackend(baseUrl, child) {
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('backend가 준비되기 전에 종료되었습니다.')
    try {
      const response = await fetch(`${baseUrl}/api/v1/users/me`)
      if (response.status === 401) return
    } catch {
      // 포트가 열릴 때까지 짧게 재시도한다.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('backend 준비 시간이 초과되었습니다.')
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false
    const finish = (exited) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      child.removeListener('exit', onExit)
      resolve(exited)
    }
    const onExit = () => finish(true)
    child.once('exit', onExit)
    const timeout = setTimeout(() => finish(false), timeoutMs)
    if (child.exitCode !== null) finish(true)
  })
}

export async function stopChild(child, timeoutMs = STOP_TIMEOUT_MS) {
  if (child.exitCode !== null) return

  const gracefulExit = waitForExit(child, timeoutMs)
  child.kill()
  if (await gracefulExit || child.exitCode !== null) return

  const forcedExit = waitForExit(child, timeoutMs)
  child.kill('SIGKILL')
  if (await forcedExit || child.exitCode !== null) return
  throw new Error('자식 프로세스가 종료되지 않았습니다.')
}

export async function ensureBackendReady(baseUrl, child, wait = waitForBackend) {
  try {
    await wait(baseUrl, child)
  } catch (readinessError) {
    try {
      await stopChild(child)
    } catch (cleanupError) {
      throw new AggregateError(
        [readinessError, cleanupError],
        'backend 준비 실패 후 프로세스를 종료하지 못했습니다.',
      )
    }
    throw readinessError
  }
}

export async function startBackend(repoRoot) {
  const backendRoot = path.join(repoRoot, 'backend')
  const wrapper = path.join(backendRoot, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew')
  await runCommand(wrapper, ['bootJar', '--no-daemon'], { cwd: backendRoot })

  const libraries = await readdir(path.join(backendRoot, 'build', 'libs'))
  const jarName = libraries.find((name) => name.endsWith('.jar') && !name.endsWith('-plain.jar'))
  if (!jarName) throw new Error('실행 가능한 backend jar를 찾지 못했습니다.')

  const port = await getFreePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const child = spawn(
    'java',
    ['-jar', path.join(backendRoot, 'build', 'libs', jarName), `--server.port=${port}`],
    { cwd: backendRoot, stdio: 'ignore' },
  )
  await ensureBackendReady(baseUrl, child)
  return {
    baseUrl,
    stop: () => stopChild(child),
  }
}

function contentType(filePath) {
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8'
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8'
  return 'text/html; charset=utf-8'
}

async function proxyRequest(request, response, backendBaseUrl) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined
  const upstream = await fetch(`${backendBaseUrl}${request.url}`, {
    method: request.method,
    headers: {
      accept: request.headers.accept ?? 'application/json',
      ...(request.headers['content-type']
        ? { 'content-type': request.headers['content-type'] }
        : {}),
      ...(request.headers.authorization
        ? { authorization: request.headers.authorization }
        : {}),
    },
    body,
  })
  const responseBody = Buffer.from(await upstream.arrayBuffer())
  response.writeHead(upstream.status, {
    'content-type': upstream.headers.get('content-type') ?? 'application/json',
  })
  response.end(responseBody)
}

export async function startFrontendServer(frontendRoot, backendBaseUrl) {
  const distDirectory = path.join(frontendRoot, 'dist')
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
      if (pathname.startsWith('/api/')) {
        await proxyRequest(request, response, backendBaseUrl)
        return
      }
      const filePath = pathname.startsWith('/assets/')
        ? path.join(distDirectory, pathname.slice(1))
        : path.join(distDirectory, 'index.html')
      if (!filePath.startsWith(distDirectory)) throw new Error('잘못된 asset 경로입니다.')
      response.writeHead(200, { 'content-type': contentType(filePath) })
      response.end(await readFile(filePath))
    } catch {
      response.writeHead(404)
      response.end()
    }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('frontend 포트를 확인하지 못했습니다.')
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    stop: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  }
}
