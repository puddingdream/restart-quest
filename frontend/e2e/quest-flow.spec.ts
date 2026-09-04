import { expect, test, type Page, type Route } from '@playwright/test';

const createdAt = '2026-09-05T00:00:00Z';

test('첫 방문부터 재시작, reload/back, 완료, 이력, 삭제까지 이어진다', async ({ page }, testInfo) => {
  await installContractBackend(page);
  await page.goto('/#now');

  await expect(page.getByRole('heading', { name: '오늘의 작은 행동부터 시작해요' })).toBeVisible();
  await page.getByLabel('이루고 싶은 구직 목표').fill('프론트엔드 직무 찾기');
  await page.getByLabel('오늘 할 가장 작은 행동').fill('채용 페이지 열기');
  await page.getByRole('button', { name: '작은 행동 시작하기' }).click();

  await expect(page.getByRole('heading', { name: '채용 페이지 열기' })).toBeVisible();
  await page.getByRole('button', { name: '막혔어요' }).click();
  await page.getByRole('radio', { name: /생각보다 너무 커요/ }).check();
  await page.getByRole('button', { name: '막힘 기록하기' }).click();

  await expect(page.getByRole('heading', { name: '다음 행동을 이만큼 줄여 봤어요' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '다음 행동을 이만큼 줄여 봤어요' })).toBeVisible();
  await page.getByRole('button', { name: '나중에 이어하기' }).click();
  await expect(page.getByRole('heading', { name: '막힌 행동을 더 작게 바꿀 수 있어요' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: '다음 행동을 이만큼 줄여 봤어요' })).toBeVisible();

  await page.getByLabel('더 작은 다음 행동').fill('관심 회사 채용 페이지 하나 열기');
  await page.getByRole('button', { name: '이 행동으로 다시 시작하기' }).click();
  await expect(page.getByRole('heading', { name: '관심 회사 채용 페이지 하나 열기' })).toBeVisible();
  await page.getByRole('button', { name: '완료했어요' }).click();
  await expect(page.getByRole('heading', { name: '한 걸음 진행했어요' })).toBeVisible();
  await page.getByRole('button', { name: /목표 완료하기/ }).click();
  await expect(page.getByRole('heading', { name: '여기까지 해낸 과정을 남겼어요' })).toBeVisible();

  await page.getByRole('link', { name: '기록' }).click();
  await expect(page.getByText('막힌 이유: 생각보다 너무 커요')).toBeVisible();
  await expect(page.getByText('관심 회사 채용 페이지 하나 열기').first()).toBeVisible();
  await assertNoHorizontalOverflow(page);

  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  await assertNoHorizontalOverflow(page);
  await page.screenshot({
    path: `node_modules/.cache/playwright-results/${testInfo.project.name}-history.png`,
    fullPage: true,
  });

  await page.getByRole('link', { name: '데이터 관리' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '내 데이터 모두 삭제하기' }).click();
  await expect(page.getByRole('heading', { name: '오늘의 작은 행동부터 시작해요' })).toBeVisible();
  await page.getByRole('link', { name: '기록' }).click();
  await expect(page.getByRole('heading', { name: '아직 기록이 없어요' })).toBeVisible();
});

async function assertNoHorizontalOverflow(page: Page) {
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflows).toBe(false);
}

async function installContractBackend(page: Page) {
  const quest = {
    id: 'quest-1', status: 'ACTIVE', title: '프론트엔드 직무 찾기', version: 0, createdAt,
  };
  const firstAction = {
    id: 'action-1', questId: quest.id, status: 'READY', title: '채용 페이지 열기', estimatedMinutes: 10, createdAt,
  };
  const blockedAttempt = {
    id: 'attempt-1', actionId: firstAction.id, outcome: 'BLOCKED', blockerCode: 'TOO_BIG', createdAt,
  };
  const suggestion = {
    strategyCode: 'FIRST_STEP_ONLY', guidance: '첫 단계만 분리했어요.', title: '첫 단계만 하기: 채용 페이지 열기', estimatedMinutes: 5,
  };
  let successor = {
    id: 'action-2', questId: quest.id, status: 'READY', title: suggestion.title, estimatedMinutes: 5,
    sourceAttemptId: blockedAttempt.id, createdAt,
  };
  let stage: 'START' | 'READY_FIRST' | 'PENDING' | 'READY_SUCCESSOR' | 'NEXT' | 'COMPLETED' = 'START';
  let sessionMissing = false;

  const blockedHistory = () => ({
    attempt: blockedAttempt,
    action: { ...firstAction, status: 'BLOCKED', endedAt: createdAt },
    ...(stage === 'PENDING' ? {} : { successorAction: successor }),
  });
  const doneHistory = () => ({
    attempt: { id: 'attempt-2', actionId: successor.id, outcome: 'DONE', createdAt },
    action: { ...successor, status: 'DONE', endedAt: createdAt },
  });
  const bootstrap = () => ({
    workspace: { id: 'workspace-1', timezone: 'Asia/Seoul' },
    activeQuest: stage === 'START' || stage === 'COMPLETED' ? null : quest,
    currentAction: stage === 'READY_FIRST' ? firstAction : stage === 'READY_SUCCESSOR' ? successor : null,
    pendingAdaptation: stage === 'PENDING' ? { attempt: blockedAttempt, suggestion } : null,
    recentAttempts: stage === 'PENDING' ? [blockedHistory()] : stage === 'READY_SUCCESSOR' ? [blockedHistory()]
      : stage === 'NEXT' || stage === 'COMPLETED' ? [doneHistory(), blockedHistory()] : [],
    nextRequiredAction: stage === 'START' ? 'CREATE_QUEST' : stage === 'READY_FIRST' || stage === 'READY_SUCCESSOR'
      ? 'DO_READY_ACTION' : stage === 'PENDING' ? 'ADAPT_BLOCKED_ACTION'
        : stage === 'COMPLETED' ? 'START_NEW_QUEST' : 'CREATE_NEXT_ACTION_OR_COMPLETE',
    csrfToken: 'csrf-e2e',
  });

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() === 'GET' && path === '/api/v1/bootstrap') {
      if (sessionMissing) {
        return fulfill(route, {
          type: 'about:blank', title: '세션이 필요합니다.', status: 401, code: 'SESSION_REQUIRED',
          detail: '새 세션을 시작해 주세요.', fieldErrors: [],
        }, 401, 'application/problem+json');
      }
      return fulfill(route, bootstrap());
    }
    if (request.method() === 'POST' && path === '/api/v1/session') {
      sessionMissing = false;
      return fulfill(route, { csrfToken: 'csrf-after-delete' }, 201);
    }
    if (request.method() === 'GET' && path === '/api/v1/history') {
      const hasHistory = stage === 'NEXT' || stage === 'COMPLETED';
      return fulfill(route, { items: hasHistory ? [doneHistory(), blockedHistory()] : [], nextCursor: null });
    }
    if (request.method() === 'POST' && path === '/api/v1/quests') {
      stage = 'READY_FIRST';
      return fulfill(route, { quest, action: firstAction, nextRequiredAction: 'DO_READY_ACTION' }, 201);
    }
    if (request.method() === 'POST' && path === `/api/v1/actions/${firstAction.id}/attempts`) {
      stage = 'PENDING';
      return fulfill(route, { attempt: blockedAttempt, suggestion, nextRequiredAction: 'ADAPT_BLOCKED_ACTION' }, 201);
    }
    if (request.method() === 'POST' && path === `/api/v1/attempts/${blockedAttempt.id}/adaptation`) {
      const input = request.postDataJSON() as { title: string; estimatedMinutes: number };
      successor = { ...successor, title: input.title, estimatedMinutes: input.estimatedMinutes };
      stage = 'READY_SUCCESSOR';
      return fulfill(route, { action: successor, nextRequiredAction: 'DO_READY_ACTION' }, 201);
    }
    if (request.method() === 'POST' && path === `/api/v1/actions/${successor.id}/attempts`) {
      stage = 'NEXT';
      return fulfill(route, { attempt: doneHistory().attempt, nextRequiredAction: 'CREATE_NEXT_ACTION_OR_COMPLETE' }, 201);
    }
    if (request.method() === 'POST' && path === `/api/v1/quests/${quest.id}/complete`) {
      stage = 'COMPLETED';
      return fulfill(route, {
        quest: { ...quest, status: 'COMPLETED', version: 1, completedAt: createdAt },
        nextRequiredAction: 'START_NEW_QUEST',
      });
    }
    if (request.method() === 'DELETE' && path === '/api/v1/workspace') {
      stage = 'START';
      sessionMissing = true;
      return route.fulfill({ status: 204, body: '' });
    }
    return route.fulfill({ status: 404, contentType: 'application/problem+json', body: JSON.stringify({
      type: 'about:blank', title: '찾을 수 없습니다.', status: 404, code: 'RESOURCE_NOT_FOUND', detail: '찾을 수 없습니다.', fieldErrors: [],
    }) });
  });
}

function fulfill(route: Route, body: unknown, status = 200, contentType = 'application/json') {
  return route.fulfill({ status, contentType, body: JSON.stringify(body) });
}
