import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test'

type BrowserApiResponse = {
  body: unknown
  status: number
}

type RequestOptions = {
  body?: unknown
  headers?: Record<string, string>
  method?: 'GET' | 'POST'
}

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url))

function expectRecord(value: unknown): asserts value is Record<string, unknown> {
  expect(value).not.toBeNull()
  expect(Array.isArray(value)).toBe(false)
  expect(typeof value).toBe('object')
}

async function recordIntegrationEvidence(testInfo: TestInfo): Promise<string> {
  const claimedHead = testInfo.project.metadata.integrationHeadSha
  const actualHead = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).trim()
  const worktreeStatus = execFileSync(
    'git',
    ['status', '--porcelain', '--untracked-files=all'],
    { cwd: repositoryRoot, encoding: 'utf8' },
  ).trim()

  expect(claimedHead, 'INTEGRATION_HEAD_SHA에 검증할 통합 head를 지정해야 합니다.').toMatch(
    /^[0-9a-f]{40}$/,
  )
  expect(claimedHead, '실행 checkout과 통합 head가 다릅니다.').toBe(actualHead)
  expect(worktreeStatus, 'E2E는 변경 없는 통합 checkout에서 실행해야 합니다.').toBe('')

  await testInfo.attach('integration-head-sha', {
    body: JSON.stringify({
      backend: claimedHead,
      frontend: claimedHead,
      runtime: claimedHead,
    }),
    contentType: 'application/json',
  })

  return claimedHead as string
}

async function browserRequest(
  page: Page,
  path: string,
  options: RequestOptions = {},
): Promise<BrowserApiResponse> {
  return page.evaluate(
    async ({ requestOptions, requestPath }) => {
      const response = await fetch(requestPath, {
        body:
          requestOptions.body === undefined
            ? undefined
            : JSON.stringify(requestOptions.body),
        credentials: 'same-origin',
        headers: requestOptions.headers,
        method: requestOptions.method ?? 'GET',
      })
      const text = await response.text()
      let body: unknown = null
      if (text) {
        try {
          body = JSON.parse(text)
        } catch {
          body = text
        }
      }
      return { body, status: response.status }
    },
    { requestOptions: options, requestPath: path },
  )
}

async function browserWrite(
  page: Page,
  path: string,
  body: unknown,
): Promise<BrowserApiResponse> {
  const csrfResponse = await browserRequest(page, '/api/v1/auth/csrf')
  expect(csrfResponse.status).toBe(200)
  expectRecord(csrfResponse.body)
  const { headerName, token } = csrfResponse.body
  expect(typeof headerName).toBe('string')
  expect(typeof token).toBe('string')

  return browserRequest(page, path, {
    body,
    headers: {
      [headerName as string]: token as string,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })
}

async function register(page: Page, email: string): Promise<void> {
  await page.goto('/register')
  await page.getByLabel('이메일').fill(email)
  await page.getByLabel('비밀번호').fill('release-e2e-password')
  await page.getByRole('button', { exact: true, name: '계정 만들기' }).click()
  await expect(page).toHaveURL(/\/today$/)
  await expect(
    page.getByRole('heading', { name: '지금 가능한 만큼만 골라요' }),
  ).toBeVisible()
}

async function createSecondAccount(
  browser: Browser,
  baseURL: string,
  email: string,
): Promise<Page> {
  const context = await browser.newContext({
    baseURL,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()
  await register(page, email)
  return page
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const sizes = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth)
}

async function expectTouchTarget(locator: Locator): Promise<void> {
  await locator.scrollIntoViewIfNeeded()
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.height).toBeGreaterThanOrEqual(44)
}

test('가입부터 막힘·축소·완료·기록까지 소유권과 경합 경계를 지킨다', async ({
  browser,
  page,
}, testInfo) => {
  const headSha = await recordIntegrationEvidence(testInfo)
  const runId = `${headSha.slice(0, 8)}-${Date.now()}`
  await page.goto('/')
  const health = await browserRequest(page, '/actuator/health')
  expect(health.status).toBe(200)
  expectRecord(health.body)
  expect(health.body.status).toBe('UP')
  await register(page, `owner-${runId}@example.test`)

  await page.getByLabel('충분해요').check()
  await page.getByLabel('30분').check()
  await page.getByLabel('지원 준비').check()
  await page.getByRole('button', { name: '오늘의 작은 행동 받기' }).click()
  await expect(
    page.getByRole('heading', {
      name: '공고 하나에 맞춰 지원 동기 첫 문장 쓰기',
    }),
  ).toBeVisible()

  const originalToday = await browserRequest(page, '/api/v1/today')
  expect(originalToday.status).toBe(200)
  expectRecord(originalToday.body)
  expectRecord(originalToday.body.activeQuest)
  const originalQuestId = originalToday.body.activeQuest.id
  const originalVersion = originalToday.body.activeQuest.version
  expect(typeof originalQuestId).toBe('string')
  expect(typeof originalVersion).toBe('number')

  await page.getByRole('button', { name: '지금은 막혔어요' }).click()
  await page.getByLabel('행동이 너무 크게 느껴져요').check()
  await page.getByLabel('메모 (선택)').fill('첫 문장부터 쓰기에는 부담이 커요.')
  await page.getByRole('button', { name: '더 작은 행동으로 바꾸기' }).click()

  await expect(
    page.getByRole('heading', { name: '요구사항 하나와 내 경험 하나 연결하기' }),
  ).toBeVisible()
  await expect(page.getByText('더 쉬워진 점: 15분 짧아졌어요 · 난이도가 1단계 쉬워졌어요')).toBeVisible()

  const smallerToday = await browserRequest(page, '/api/v1/today')
  expect(smallerToday.status).toBe(200)
  expectRecord(smallerToday.body)
  expectRecord(smallerToday.body.activeQuest)
  const smallerQuestId = smallerToday.body.activeQuest.id
  const smallerVersion = smallerToday.body.activeQuest.version
  expect(typeof smallerQuestId).toBe('string')
  expect(typeof smallerVersion).toBe('number')
  expect(smallerToday.body.activeQuest.predecessorQuestId).toBe(originalQuestId)

  let completeRequestCount = 0
  const countCompleteRequest = (request: { method(): string; url(): string }) => {
    if (
      request.method() === 'POST' &&
      request.url().endsWith(`/api/v1/quests/${smallerQuestId}/complete`)
    ) {
      completeRequestCount += 1
    }
  }
  page.on('request', countCompleteRequest)
  await page.getByRole('button', { name: '완료했어요' }).evaluate((button) => {
    const completeButton = button as HTMLButtonElement
    completeButton.click()
    completeButton.click()
  })
  await expect(
    page.getByRole('heading', { name: '오늘은 여기까지면 충분해요' }),
  ).toBeVisible()
  page.off('request', countCompleteRequest)
  expect(completeRequestCount).toBe(1)

  const staleCompletion = await browserWrite(
    page,
    `/api/v1/quests/${smallerQuestId}/complete`,
    { version: smallerVersion },
  )
  expect(staleCompletion.status).toBe(409)
  expectRecord(staleCompletion.body)
  expect(staleCompletion.body.code).toBe('STALE_QUEST')

  const history = await browserRequest(
    page,
    `/api/v1/history?from=${smallerToday.body.date}&to=${smallerToday.body.date}`,
  )
  expect(history.status).toBe(200)
  expectRecord(history.body)
  expect(Array.isArray(history.body.days)).toBe(true)
  const days = history.body.days as Array<Record<string, unknown>>
  expect(days).toHaveLength(1)
  expect(Array.isArray(days[0].outcomes)).toBe(true)
  const outcomes = days[0].outcomes as Array<Record<string, unknown>>
  expect(outcomes).toHaveLength(2)
  expect(outcomes.map((outcome) => outcome.type)).toEqual(['BLOCKED', 'COMPLETED'])

  const foreignPage = await createSecondAccount(
    browser,
    new URL(page.url()).origin,
    `other-${runId}@example.test`,
  )
  try {
    const foreignToday = await browserRequest(foreignPage, '/api/v1/today')
    expect(foreignToday.status).toBe(200)
    expect(JSON.stringify(foreignToday.body)).not.toContain(smallerQuestId as string)

    const foreignHistory = await browserRequest(
      foreignPage,
      `/api/v1/history?from=${smallerToday.body.date}&to=${smallerToday.body.date}`,
    )
    expect(foreignHistory.status).toBe(200)
    expect(JSON.stringify(foreignHistory.body)).not.toContain(smallerQuestId as string)
    expect(JSON.stringify(foreignHistory.body)).not.toContain('첫 문장부터 쓰기에는 부담이 커요.')

    const foreignComplete = await browserWrite(
      foreignPage,
      `/api/v1/quests/${smallerQuestId}/complete`,
      { version: smallerVersion },
    )
    expect(foreignComplete.status).toBe(404)
    expectRecord(foreignComplete.body)
    expect(foreignComplete.body.code).toBe('RESOURCE_NOT_FOUND')

    const foreignBlock = await browserWrite(
      foreignPage,
      `/api/v1/quests/${smallerQuestId}/block`,
      { barrier: 'NO_TIME', version: smallerVersion },
    )
    expect(foreignBlock.status).toBe(404)
    expectRecord(foreignBlock.body)
    expect(foreignBlock.body.code).toBe('RESOURCE_NOT_FOUND')
  } finally {
    await foreignPage.context().close()
  }

  await page.getByRole('link', { name: '최근 기록 보기' }).click()
  await expect(page).toHaveURL(/\/history$/)
  await expect(page.getByRole('heading', { name: '다시 시작한 기록' })).toBeVisible()
  await expect(page.getByText('더 작게 재시도')).toBeVisible()
  await expect(page.getByText('완료', { exact: true })).toBeVisible()
  await expect(page.getByText('내 메모: 첫 문장부터 쓰기에는 부담이 커요.')).toBeVisible()
  await testInfo.attach('completed-history', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })

  expect(originalVersion).toBe(0)
})

test('@viewport 핵심 CTA와 오류·빈 상태를 키보드로 사용할 수 있다', async ({
  page,
}, testInfo) => {
  await recordIntegrationEvidence(testInfo)
  await page.goto('/register')

  const email = page.getByLabel('이메일')
  const password = page.getByLabel('비밀번호')
  const registerButton = page.getByRole('button', {
    exact: true,
    name: '계정 만들기',
  })

  await email.focus()
  await page.keyboard.type('invalid-email')
  await page.keyboard.press('Tab')
  await expect(password).toBeFocused()
  await page.keyboard.type('short')
  await page.keyboard.press('Tab')
  await expect(registerButton).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page.getByText('입력 내용을 확인해 주세요.')).toBeVisible()
  await expect(page.getByText('올바른 이메일을 입력해 주세요.')).toBeVisible()
  await expect(page.getByText('비밀번호는 10~72자로 입력해 주세요.')).toBeVisible()
  await expectTouchTarget(registerButton)
  await expectNoHorizontalOverflow(page)
  await testInfo.attach(`${testInfo.project.name}-validation-error`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })

  await page.route('**/api/v1/auth/me', async (route) =>
    route.fulfill({
      body: JSON.stringify({
        user: { email: 'viewport@example.test', id: 'viewport-user' },
      }),
      contentType: 'application/json',
      status: 200,
    }),
  )
  await page.route('**/api/v1/history?**', async (route) =>
    route.fulfill({ body: JSON.stringify({ days: [] }), contentType: 'application/json', status: 200 }),
  )
  await page.route('**/api/v1/today', async (route) =>
    route.fulfill({
      body: JSON.stringify({
        activeQuest: null,
        checkIn: null,
        completedQuest: null,
        date: '2026-09-04',
        phase: 'CHECK_IN_REQUIRED',
      }),
      contentType: 'application/json',
      status: 200,
    }),
  )
  await page.goto('/history')

  const todayLink = page.getByRole('link', { name: '오늘로 이동하기' })
  await expect(page.getByRole('heading', { name: '아직 기록이 없어요' })).toBeVisible()
  await expectTouchTarget(todayLink)
  await expectNoHorizontalOverflow(page)
  await testInfo.attach(`${testInfo.project.name}-empty-history`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })

  await todayLink.focus()
  await expect(todayLink).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/today$/)
  await expect(
    page.getByRole('button', { name: '오늘의 작은 행동 받기' }),
  ).toBeVisible()
  await expectNoHorizontalOverflow(page)
})
