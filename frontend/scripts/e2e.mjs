import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { runRequiredBrowserFlow } from './e2e/headlessBrowser.mjs'
import { runCommand, startBackend, startFrontendServer } from './e2e/localStack.mjs'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(frontendRoot, '..')
const resultDirectory = path.join(frontendRoot, 'test-results')

function fill(selector, value) {
  return `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return false;
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(value)});
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`
}

async function expectApiErrors(backendBaseUrl) {
  const unauthorized = await fetch(`${backendBaseUrl}/api/v1/users/me`, {
    headers: { authorization: 'Bearer expired-e2e-token' },
  })
  assert.equal(unauthorized.status, 401)
  assert.equal((await unauthorized.json()).code, 'UNAUTHORIZED')

  const email = `onboarding-required-${Date.now()}@example.test`
  const signup = await fetch(`${backendBaseUrl}/api/v1/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'safe-e2e-password', name: '통합 확인' }),
  })
  assert.equal(signup.status, 201)
  const { accessToken } = await signup.json()
  const generation = await fetch(`${backendBaseUrl}/api/v1/quests/today/generate`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ energyLevel: 'LOW' }),
  })
  assert.equal(generation.status, 409)
  assert.equal((await generation.json()).code, 'ONBOARDING_REQUIRED')
}

async function verifyFrontendHttpBuild(frontendBaseUrl) {
  const htmlResponse = await fetch(`${frontendBaseUrl}/today`)
  assert.equal(htmlResponse.status, 200)
  const html = await htmlResponse.text()
  assert.match(html, /name="restart-quest-api-mode" content="http"/)
  const assetResponse = await fetch(`${frontendBaseUrl}/assets/index.js`)
  assert.equal(assetResponse.status, 200)
  assert.ok((await assetResponse.arrayBuffer()).byteLength > 0)
}

async function runBrowserFlow(page, baseUrl) {
  const email = `core-flow-${Date.now()}@example.test`
  await page.goto(`${baseUrl}/signup`)
  await page.waitFor("document.querySelector('#name')", '회원가입 폼')
  await page.evaluate(fill('#name', '다시 시작'))
  await page.evaluate(fill('#email', email))
  await page.evaluate(fill('#password', 'safe-e2e-password'))
  await page.evaluate("document.querySelector('form').requestSubmit()")

  await page.waitFor("location.pathname === '/onboarding' && document.querySelector('#desiredJob')", '온보딩 이동')
  await page.evaluate(fill('#desiredJob', '프론트엔드 개발자'))
  await page.evaluate(fill('#region', '서울 또는 원격'))
  await page.evaluate("document.querySelector('form').requestSubmit()")

  await page.waitFor("location.pathname === '/today' && document.querySelector('input[name=energyLevel]')", '오늘 퀘스트 이동')
  await page.evaluate("document.querySelector('input[name=energyLevel][value=LOW]').click()")
  await page.evaluate("document.querySelector('.energy-form').requestSubmit()")
  await page.waitFor("document.querySelectorAll('.quest-card').length === 3", '세 퀘스트 생성')
  assert.equal(await page.evaluate("[...document.querySelectorAll('.quest-card h2')].every((node) => node.textContent.trim() && !node.textContent.includes('undefined'))"), true)

  await page.evaluate("document.querySelectorAll('.quest-card')[0].querySelector('.button-primary').click()")
  await page.waitFor("document.querySelectorAll('.quest-card')[0].classList.contains('quest-card-completed')", '첫 여정 완료')

  await page.evaluate("[...document.querySelectorAll('.quest-card')[1].querySelectorAll('button')].find((button) => button.textContent.includes('더 작게')).click()")
  await page.waitFor("document.querySelector('[role=dialog]')", '재설계 dialog')
  await page.evaluate("document.querySelector('input[name=reasonCode][value=TASK_TOO_LARGE]').click()")
  await page.evaluate(fill('[role=dialog] textarea', '오늘은 첫 단계만 이어가고 싶어요.'))
  await page.evaluate("document.querySelector('[role=dialog] form').requestSubmit()")
  await page.waitFor("!document.querySelector('[role=dialog]') && document.querySelectorAll('.quest-card')[1].querySelector('h2').textContent.includes('첫 단계만 시작하기')", '이유 기반 재설계')

  await page.reload()
  await page.waitFor("document.querySelectorAll('.quest-card').length === 3 && document.querySelectorAll('.quest-card')[1].querySelector('details')", 'today 새로고침 일치')
  assert.equal(await page.evaluate("document.querySelectorAll('.quest-card')[0].classList.contains('quest-card-completed')"), true)

  const resolvedError = await page.evaluate(`(async () => {
    const token = sessionStorage.getItem('restart-quest.access-token');
    const today = await fetch('/api/v1/quests/today', { headers: { authorization: 'Bearer ' + token } }).then((response) => response.json());
    const completed = today.journeys.find((journey) => journey.status === 'COMPLETED');
    const response = await fetch('/api/v1/quests/' + completed.currentQuest.questId + '/completion', {
      method: 'POST', headers: { authorization: 'Bearer ' + token }
    });
    return { status: response.status, code: (await response.json()).code };
  })()`)
  assert.deepEqual(resolvedError, { status: 409, code: 'QUEST_ALREADY_RESOLVED' })

  await page.evaluate("document.querySelector('a[href=\"/dashboard\"]').click()")
  await page.waitFor("location.pathname === '/dashboard' && document.querySelector('#dashboard-title')?.textContent.includes('오늘 3개 중 1개')", '대시보드 반영')
  assert.deepEqual(await page.evaluate("[...document.querySelectorAll('.dashboard-counts dd')].map((node) => node.textContent.trim())"), ['3', '1', '1'])
  assert.equal(await page.evaluate("document.querySelector('.redesign-record-list h3')?.textContent.includes('첫 단계만 시작하기')"), true)

  await page.reload()
  await page.waitFor("document.querySelector('#dashboard-title')?.textContent.includes('오늘 3개 중 1개') && document.querySelector('.redesign-record-list h3')", 'dashboard 새로고침 일치')
  await page.screenshot(path.join(resultDirectory, 'core-flow-dashboard-desktop.png'))

  await page.setViewport(390, 844, true)
  await page.evaluate("document.querySelector('a[href=\"/today\"]').click()")
  await page.waitFor("location.pathname === '/today' && document.querySelectorAll('.quest-card').length === 3", '모바일 today')
  await page.evaluate("[...document.querySelectorAll('.quest-card')[1].querySelectorAll('button')].find((button) => button.textContent.includes('더 작게')).click()")
  await page.waitFor("document.querySelector('[role=dialog]')", '모바일 재설계 dialog')
  await page.screenshot(path.join(resultDirectory, 'core-flow-redesign-mobile.png'))

  await page.evaluate("sessionStorage.setItem('restart-quest.access-token', 'expired-e2e-token')")
  await page.reload()
  await page.waitFor("location.pathname === '/login' && document.querySelector('#email')", '인증 만료 후 로그인 이동')
}

let backend
let frontend
let browser
try {
  await runCommand(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
    cwd: frontendRoot,
    env: { VITE_API_MODE: 'http' },
  })
  backend = await startBackend(repoRoot)
  await expectApiErrors(backend.baseUrl)
  frontend = await startFrontendServer(frontendRoot, backend.baseUrl)
  await verifyFrontendHttpBuild(frontend.baseUrl)
  browser = await runRequiredBrowserFlow(runBrowserFlow, frontend.baseUrl)
  console.log('Core flow E2E passed in browser: auth, onboarding, 3 journeys, completion, redesign, refresh consistency, typed errors, desktop/mobile screenshots')
} finally {
  await browser?.stop()
  await frontend?.stop()
  await backend?.stop()
}
