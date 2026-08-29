import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { launchBrowser } from './e2e/headlessBrowser.mjs'
import { runCommand, startBackend, startFrontendServer } from './e2e/localStack.mjs'
import { combinePrimaryAndCleanup } from './e2e/browserProcess.mjs'
import {
  fillFormValue,
  fillOnboardingHappyPath,
} from './e2e/onboardingFlow.mjs'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(frontendRoot, '..')
const resultDirectory = path.resolve(
  process.env.E2E_ARTIFACT_DIR ?? path.join(frontendRoot, 'test-results'),
)

function frontendTool(name) {
  return path.join(
    frontendRoot,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? `${name}.cmd` : name,
  )
}

async function buildFrontendForHttp() {
  await runCommand(
    frontendTool('tsc'),
    ['-p', 'tsconfig.app.json', '--pretty', 'false', '--incremental', 'false'],
    { cwd: frontendRoot },
  )
  await runCommand(frontendTool('vite'), ['build'], {
    cwd: frontendRoot,
    env: { VITE_API_MODE: 'http' },
  })
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

async function apiRequest(baseUrl, pathName, options = {}) {
  const response = await fetch(`${baseUrl}/api/v1${pathName}`, {
    method: options.method ?? 'GET',
    headers: {
      accept: 'application/json',
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.body ? { 'content-type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(`API ${pathName} 응답이 ${response.status}/${payload.code ?? 'UNKNOWN'}였습니다.`)
  }
  return payload
}

async function runApiCoreFlow(backendBaseUrl) {
  const signup = await apiRequest(backendBaseUrl, '/auth/signup', {
    method: 'POST',
    body: {
      email: `core-flow-api-${Date.now()}@example.test`,
      password: 'safe-e2e-password',
      name: '다시 시작',
    },
  })
  const token = signup.accessToken
  await apiRequest(backendBaseUrl, '/onboarding/me', {
    method: 'PUT',
    token,
    body: {
      desiredJob: '프론트엔드 개발자',
      region: '서울 또는 원격',
      desiredWorkType: 'ANY',
      careerGapMonths: 3,
      hasResume: true,
      interviewExperience: 'LIMITED',
    },
  })
  const generated = await apiRequest(backendBaseUrl, '/quests/today/generate', {
    method: 'POST',
    token,
    body: { energyLevel: 'LOW' },
  })
  assert.equal(generated.journeys.length, 3)

  const completedQuestId = generated.journeys[0].currentQuest.questId
  const redesignQuestId = generated.journeys[1].currentQuest.questId
  await apiRequest(backendBaseUrl, `/quests/${completedQuestId}/completion`, {
    method: 'POST',
    token,
  })
  const redesigned = await apiRequest(
    backendBaseUrl,
    `/quests/${redesignQuestId}/failure-redesign`,
    {
      method: 'POST',
      token,
      body: {
        reasonCode: 'TASK_TOO_LARGE',
        reasonNote: '오늘은 첫 단계만 이어가고 싶어요.',
      },
    },
  )
  assert.equal(redesigned.currentQuest.title, '한 조각만 끝내기')
  assert.equal(redesigned.history.length, 1)

  const today = await apiRequest(backendBaseUrl, '/quests/today', { token })
  assert.equal(today.journeys.length, 3)
  assert.equal(today.journeys.filter((journey) => journey.status === 'COMPLETED').length, 1)
  assert.equal(today.journeys[1].history.length, 1)
  assert.equal(today.journeys[1].currentQuest.questId, redesigned.currentQuest.questId)

  const dashboard = await apiRequest(backendBaseUrl, '/dashboard/today', { token })
  assert.equal(dashboard.totalJourneys, 3)
  assert.equal(dashboard.completedJourneys, 1)
  assert.equal(dashboard.redesignCount, 1)
  assert.equal(dashboard.recentRedesigns[0].replacementQuestTitle, '한 조각만 끝내기')

  const duplicate = await fetch(
    `${backendBaseUrl}/api/v1/quests/${completedQuestId}/completion`,
    { method: 'POST', headers: { authorization: `Bearer ${token}` } },
  )
  assert.equal(duplicate.status, 409)
  assert.equal((await duplicate.json()).code, 'QUEST_ALREADY_RESOLVED')
}

async function verifyFrontendHttpBuild(frontendBaseUrl) {
  const htmlResponse = await fetch(`${frontendBaseUrl}/today`)
  assert.equal(htmlResponse.status, 200)
  const html = await htmlResponse.text()
  const assetPath = html.match(/<script[^>]+src="([^"]+\.js)"/)?.[1]
  assert.ok(assetPath, 'Vite가 생성한 JavaScript asset 경로가 필요합니다.')
  const assetResponse = await fetch(`${frontendBaseUrl}${assetPath}`)
  assert.equal(assetResponse.status, 200)
  assert.ok((await assetResponse.arrayBuffer()).byteLength > 0)
}

async function runBrowserFlow(page, baseUrl) {
  const email = `core-flow-${Date.now()}@example.test`
  await page.goto(`${baseUrl}/signup`)
  await page.waitFor("document.querySelector('#name')", '회원가입 폼')
  await fillFormValue(page, '#name', '다시 시작')
  await fillFormValue(page, '#email', email)
  await fillFormValue(page, '#password', 'safe-e2e-password')
  await page.evaluate("document.querySelector('form').requestSubmit()")

  await page.waitFor("location.pathname === '/onboarding' && document.querySelector('#desiredJob')", '온보딩 이동')
  assert.equal(
    await page.evaluate(`(() => {
      const token = sessionStorage.getItem('restart-quest.access-token');
      return Boolean(token) && !location.href.includes(token) && !document.body.innerText.includes(token);
    })()`),
    true,
  )
  await fillOnboardingHappyPath(page)
  await page.evaluate("document.querySelector('form').requestSubmit()")

  await page.waitFor("location.pathname === '/today' && document.querySelector('input[name=energyLevel]')", '오늘 퀘스트 이동')
  await page.evaluate("document.querySelector('input[name=energyLevel][value=LOW]').click()")
  await page.evaluate("document.querySelector('.energy-form').requestSubmit()")
  await page.waitFor(
    "document.querySelectorAll('.quest-card').length === 3 && [...document.querySelectorAll('.quest-card')[0].querySelectorAll('button')].some((button) => button.textContent.includes('완료했어요'))",
    '세 퀘스트 생성',
  )
  assert.equal(await page.evaluate("[...document.querySelectorAll('.quest-card h2')].every((node) => node.textContent.trim() && !node.textContent.includes('undefined'))"), true)

  await page.evaluate(`(() => {
    const button = [...document.querySelectorAll('.quest-card')[0].querySelectorAll('button')]
      .find((candidate) => candidate.textContent.includes('완료했어요'));
    if (!button) throw new Error('첫 퀘스트 완료 버튼을 찾지 못했습니다.');
    button.click();
  })()`)
  await page.waitFor("document.querySelectorAll('.quest-card')[0].classList.contains('quest-card-completed')", '첫 여정 완료')

  await page.evaluate("[...document.querySelectorAll('.quest-card')[1].querySelectorAll('button')].find((button) => button.textContent.includes('더 작게')).click()")
  await page.waitFor("document.querySelector('[role=dialog]')", '재설계 dialog')
  await page.evaluate("document.querySelector('input[name=reasonCode][value=TASK_TOO_LARGE]').click()")
  await fillFormValue(
    page,
    '[role=dialog] textarea',
    '오늘은 첫 단계만 이어가고 싶어요.',
  )
  await page.evaluate("document.querySelector('[role=dialog] form').requestSubmit()")
  await page.waitFor("!document.querySelector('[role=dialog]') && document.querySelectorAll('.quest-card')[1].querySelector('h2').textContent.includes('한 조각만 끝내기')", '이유 기반 재설계')

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
  assert.equal(await page.evaluate("document.querySelector('.redesign-record-list h3')?.textContent.includes('한 조각만 끝내기')"), true)

  await page.reload()
  await page.waitFor("document.querySelector('#dashboard-title')?.textContent.includes('오늘 3개 중 1개') && document.querySelector('.redesign-record-list h3')", 'dashboard 새로고침 일치')
  await page.screenshot(path.join(resultDirectory, 'core-flow-dashboard-desktop.png'))

  await page.setViewport(390, 844, true)
  await page.evaluate("document.querySelector('a[href=\"/today\"]').click()")
  await page.waitFor(
    "location.pathname === '/today' && document.querySelectorAll('.quest-card').length === 3 && [...document.querySelectorAll('.quest-card')[1].querySelectorAll('button')].some((button) => button.textContent.includes('더 작게'))",
    '모바일 today',
  )
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
let primaryError = null
try {
  await buildFrontendForHttp()
  backend = await startBackend(repoRoot)
  await expectApiErrors(backend.baseUrl)
  frontend = await startFrontendServer(frontendRoot, backend.baseUrl)
  await verifyFrontendHttpBuild(frontend.baseUrl)
  try {
    browser = await launchBrowser()
  } catch (error) {
    if (process.env.E2E_REQUIRE_BROWSER === '1') throw error
    await runApiCoreFlow(backend.baseUrl)
    console.log('Core flow E2E passed with HTTP fallback: auth, onboarding, 3 journeys, completion, redesign, refresh consistency, typed errors')
  }
  if (browser) {
    await runBrowserFlow(browser.page, frontend.baseUrl)
    console.log('Core flow E2E passed in browser: auth, onboarding, 3 journeys, completion, redesign, refresh consistency, typed errors, desktop/mobile screenshots')
  }
} catch (error) {
  primaryError = error
}

const cleanupResults = await Promise.allSettled([
  browser?.stop(),
  frontend?.stop(),
  backend?.stop(),
])
const cleanupErrors = cleanupResults.flatMap((result) =>
  result.status === 'rejected' ? [result.reason] : [],
)
const cleanupError =
  cleanupErrors.length > 1
    ? new AggregateError(cleanupErrors, 'E2E 자원 정리에 실패했습니다.')
    : cleanupErrors[0]

if (primaryError) {
  throw combinePrimaryAndCleanup(primaryError, cleanupError)
}
if (cleanupError) {
  throw cleanupError
}
