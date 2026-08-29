import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  browserLaunchArgs,
  browserProcessDiagnostics,
  browserRuntimeFailure,
  cleanupBrowserResources,
  combinePrimaryAndCleanup,
  createBrowserProfile,
  redactBrowserArgs,
  selectBrowserExecutable,
  spawnBrowserProcess,
} from './browserProcess.mjs'
import { waitForDevTools } from './devToolsEndpoint.mjs'

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

function errorWithDiagnostics(error, diagnostics) {
  const message = error instanceof Error ? error.message : String(error)
  return new Error(`${message}\n${diagnostics}`, { cause: error })
}

export async function launchBrowser(overrides = {}) {
  const platform = overrides.platform ?? process.platform
  const env = overrides.env ?? process.env
  const selectExecutable =
    overrides.selectExecutable ?? selectBrowserExecutable
  const createProfile = overrides.createProfile ?? createBrowserProfile
  const spawnProcess = overrides.spawnProcess ?? spawnBrowserProcess
  const awaitDevTools = overrides.awaitDevTools ?? waitForDevTools
  const createPage = overrides.createPage ?? ((url) => new CdpPage(url))
  const cleanup = overrides.cleanup ?? cleanupBrowserResources
  const logger = overrides.logger ?? console

  let profileDirectory
  let processInfo
  let selection
  let args
  try {
    selection = await selectExecutable({ platform, env })
    profileDirectory = await createProfile()
    args = browserLaunchArgs({ platform, env, profileDirectory })
    logger.info(
      `[e2e/browser] selected=${selection.source}:${path.basename(
        selection.executable,
      )} candidates=${selection.checked
        .map(({ source, result }) => `${source}:${result}`)
        .join(',')} platform=${platform} ` +
        `profile=created,canonical,temporary args=${redactBrowserArgs(args).join(' ')}`,
    )
    processInfo = spawnProcess(selection.executable, args, { platform })
    const webSocketUrl = await awaitDevTools({
      profileDirectory,
      childState: processInfo.state,
      getRuntimeFailure: () => browserRuntimeFailure(processInfo.stderr),
    })
    const page = createPage(webSocketUrl)
    await page.connect()
    await page.setViewport(1440, 1000)

    let stopped = false
    return {
      page,
      stop: async () => {
        if (stopped) return
        stopped = true
        let pageError = null
        try {
          page.close()
        } catch (error) {
          pageError = error
        }
        let cleanupError = null
        try {
          await cleanup({ child: processInfo.child, profileDirectory })
        } catch (error) {
          cleanupError = error
        }
        if (pageError) throw combinePrimaryAndCleanup(pageError, cleanupError)
        if (cleanupError) throw cleanupError
      },
    }
  } catch (error) {
    const canDescribeLaunch = Boolean(selection && args)
    const diagnosticState = processInfo?.state ?? {
      spawnError: error instanceof Error ? error : new Error(String(error)),
      exitCode: null,
      signal: null,
    }
    const primary = canDescribeLaunch
      ? errorWithDiagnostics(
          error,
          browserProcessDiagnostics({
            platform,
            selection,
            args,
            profileDirectory,
            stdout: processInfo?.stdout,
            stderr: processInfo?.stderr,
            state: diagnosticState,
          }),
        )
      : error
    let cleanupError = null
    try {
      if (profileDirectory) {
        await cleanup({ child: processInfo?.child, profileDirectory })
      }
    } catch (cleanupFailure) {
      cleanupError = cleanupFailure
    }
    throw combinePrimaryAndCleanup(primary, cleanupError)
  }
}
