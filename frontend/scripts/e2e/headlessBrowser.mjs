import { spawn } from 'node:child_process'
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getFreePort } from './localStack.mjs'

const BROWSER_TIMEOUT_MS = 15_000
const BROWSER_CLOSE_TIMEOUT_MS = 1_000
const BROWSER_EXIT_TIMEOUT_MS = 4_000
const PROFILE_REMOVE_MAX_RETRIES = 10
const PROFILE_REMOVE_RETRY_DELAY_MS = 250

function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null) return Promise.resolve(true)
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      child.off('exit', onExit)
      resolve(false)
    }, timeoutMs)
    const onExit = () => {
      clearTimeout(timeout)
      resolve(true)
    }
    child.once('exit', onExit)
  })
}

async function terminateBrowserProcess(child) {
  if (child.exitCode !== null) return
  if (process.platform === 'win32' && child.pid) {
    await new Promise((resolve) => {
      const killer = spawn(
        'taskkill.exe',
        ['/pid', String(child.pid), '/t', '/f'],
        { stdio: 'ignore' },
      )
      killer.once('error', resolve)
      killer.once('exit', resolve)
    })
  } else {
    child.kill()
  }
  if (await waitForExit(child, BROWSER_EXIT_TIMEOUT_MS)) return
  if (child.exitCode === null) child.kill('SIGKILL')
  if (!(await waitForExit(child, BROWSER_EXIT_TIMEOUT_MS))) {
    throw new Error(`headless browser 프로세스(PID ${child.pid})를 종료하지 못했습니다.`)
  }
}

export function removeBrowserProfile(profileDirectory, remove = rm) {
  return remove(profileDirectory, {
    recursive: true,
    force: true,
    maxRetries: PROFILE_REMOVE_MAX_RETRIES,
    retryDelay: PROFILE_REMOVE_RETRY_DELAY_MS,
  })
}

export function browserLaunchArgs(port, profileDirectory) {
  return [
    '--headless=new',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-gpu',
    '--disable-spell-checking',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDirectory}`,
    '--window-size=1440,1000',
    'about:blank',
  ]
}

export async function requestBrowserShutdown(
  page,
  timeoutMs = BROWSER_CLOSE_TIMEOUT_MS,
) {
  let timeout
  try {
    await Promise.race([
      Promise.resolve()
        .then(() => page.send('Browser.close'))
        .catch(() => undefined),
      new Promise((resolve) => {
        timeout = setTimeout(resolve, timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timeout)
    page.close()
  }
}

async function firstAvailable(paths) {
  for (const candidate of paths) {
    if (!candidate) continue
    try {
      await access(candidate)
      return candidate
    } catch {
      // 다음 설치 위치를 확인한다.
    }
  }
  throw new Error('Chrome 또는 Edge 실행 파일을 찾지 못했습니다. CHROME_PATH를 지정해 주세요.')
}

async function browserExecutable() {
  if (process.platform === 'win32') {
    return firstAvailable([
      process.env.CHROME_PATH,
      path.join(process.env.ProgramFiles ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env['ProgramFiles(x86)'] ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(process.env.LOCALAPPDATA ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ])
  }
  return firstAvailable([
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ])
}

async function waitForPage(port, child) {
  const deadline = Date.now() + BROWSER_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('headless browser가 준비되기 전에 종료되었습니다.')
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json())
      const page = targets.find((target) => target.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
      // DevTools endpoint가 준비될 때까지 재시도한다.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('headless browser 준비 시간이 초과되었습니다.')
}

class CdpPage {
  constructor(webSocketUrl) {
    this.socket = new WebSocket(webSocketUrl)
    this.nextId = 1
    this.pending = new Map()
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true })
      this.socket.addEventListener('error', reject, { once: true })
    })
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (!message.id) return
      const pending = this.pending.get(message.id)
      if (!pending) return
      this.pending.delete(message.id)
      if (message.error) pending.reject(new Error(message.error.message))
      else pending.resolve(message.result)
    })
    await this.send('Page.enable')
    await this.send('Runtime.enable')
  }

  send(method, params = {}) {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    if (result.exceptionDetails) {
      const description =
        result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text ??
        '알 수 없는 오류'
      throw new Error(`브라우저 평가 중 오류가 발생했습니다: ${description}`)
    }
    return result.result.value
  }

  async goto(url) {
    await this.send('Page.navigate', { url })
    await this.waitFor("document.readyState === 'complete'", '페이지 로드')
  }

  async reload() {
    await this.send('Page.reload', { ignoreCache: true })
    await this.waitFor("document.readyState === 'complete'", '페이지 새로고침')
  }

  async waitFor(expression, description, timeoutMs = 12_000) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (await this.evaluate(`Boolean(${expression})`)) return
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error(`${description} 확인 시간이 초과되었습니다.`)
  }

  async setViewport(width, height, mobile = false) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
    })
  }

  async screenshot(filePath) {
    await mkdir(path.dirname(filePath), { recursive: true })
    const result = await this.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    })
    await writeFile(filePath, Buffer.from(result.data, 'base64'))
  }

  close() {
    this.socket.close()
  }
}

export async function launchBrowser() {
  const port = await getFreePort()
  const profileDirectory = await mkdtemp(path.join(os.tmpdir(), 'restart-quest-e2e-'))
  const child = spawn(
    await browserExecutable(),
    browserLaunchArgs(port, profileDirectory),
    { stdio: 'ignore' },
  )
  let page
  try {
    page = new CdpPage(await waitForPage(port, child))
    await page.connect()
    await page.setViewport(1440, 1000)
  } catch (error) {
    await terminateBrowserProcess(child)
    await removeBrowserProfile(profileDirectory)
    throw error
  }
  return {
    page,
    stop: async () => {
      await requestBrowserShutdown(page)
      await terminateBrowserProcess(child)
      await removeBrowserProfile(profileDirectory)
    },
  }
}
