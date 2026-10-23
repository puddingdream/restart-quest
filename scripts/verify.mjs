import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const startedAt = new Date().toISOString();
const stages = [];
const screenshots = [];
const dashboards = [];
let server;
let browser;
let activePage;
let runDirectory;
let temporaryDirectory;
let sha = 'unavailable';

// Independent expectations from docs/IMPLEMENTATION.md. A rationale-only
// change must never satisfy the reason-specific action checks.
const expectedRedesigns = {
  time: [
    ['직무명 첫 글자 적기', '떠오르는 직무명의 첫 글자 하나만 적고 멈추세요.'],
    ['직무 키워드 1개만 적기', '자료 조사나 이유 없이 떠오르는 직무명 하나만 적으세요.'],
    ['직무 키워드 2개만 적기', '이유를 쓰거나 자료를 찾지 말고, 떠오르는 직무명 두 개만 적으세요.']
  ],
  energy: [
    ['예시 직무 하나 표시하기', '기획·디자인 중 덜 부담스러운 것 하나만 동그라미 치거나 적으세요.'],
    ['예시 직무에서 1개 고르기', '기획·디자인·개발 중 지금 덜 부담스러운 직무 하나만 골라 적으세요.'],
    ['예시 직무에서 2개 고르기', '새로 찾지 말고 기획·디자인·개발 중 부담 없는 직무 두 개만 골라 적으세요.']
  ],
  too_hard: [
    ['업무 동사 첫 글자 적기', '쓰기·만들기 중 해보고 싶은 동작의 첫 글자 하나만 적으세요.'],
    ['해보고 싶은 업무 동사 1개 적기', '직무명을 정하지 말고 쓰기·만들기·정리하기 중 해보고 싶은 동작 하나만 적으세요.'],
    ['해보고 싶은 업무 동사 2개 적기', '직무명을 결정하지 말고, 쓰기·만들기·정리하기처럼 해보고 싶은 동작 두 개만 적으세요.']
  ],
  unclear: [
    ['일의 첫 글자 한 칸 채우기', '‘해보고 싶은 일: ___’의 빈칸에 떠오르는 업무 동사의 첫 글자 하나만 넣으세요.'],
    ['하고 싶은 일 한 칸 채우기', '‘해보고 싶은 일: ___’의 빈칸에 업무 동사 하나만 넣으세요.'],
    ['하고 싶은 일 두 칸 채우기', '‘해보고 싶은 일: ___, ___’의 두 빈칸에 업무 동사 하나씩 넣으세요.']
  ],
  other: [
    ['관심 직무 키워드 1개 적기', '지금 떠오르는 키워드 한 단어만 적으세요.'],
    ['관심 직무 키워드 1개와 이유 적기', '키워드 1개와 관심이 가는 이유 한 줄을 적으세요.'],
    ['관심 직무 키워드 2개와 이유 적기', '떠오르는 직무 키워드 2개와 그중 하나를 고른 이유 한 줄을 적으세요.']
  ]
};

function assertSuggestedAction(suggestion, parent, reasonCode) {
  const level = parent.level - 1;
  const [title, instruction] = expectedRedesigns[reasonCode][level];
  assert.equal(suggestion.parentId, parent.id);
  assert.equal(suggestion.reasonCode, reasonCode);
  assert.equal(suggestion.level, level);
  assert.equal(suggestion.minutes, [2, 5, 10][level]);
  assert.ok(suggestion.minutes < parent.minutes);
  assert.equal(suggestion.title, title);
  assert.equal(suggestion.instruction, instruction);
}

function assertConfirmedAction(child, parent, suggestion) {
  assert.equal(child.parentId, parent.id);
  assert.equal(child.rootId, parent.rootId);
  assert.equal(child.redesignReason, suggestion.reasonCode);
  for (const key of ['level', 'minutes', 'title', 'instruction']) {
    assert.equal(child[key], suggestion[key], `확정된 후손의 ${key}`);
  }
}

function options(argv) {
  const values = new Map();
  for (const item of argv) {
    const match = /^--([^=]+)=(.+)$/.exec(item);
    if (!match || values.has(match[1])) throw new Error(`잘못된 인수: ${item}`);
    values.set(match[1], match[2]);
  }
  if (values.size !== 2 || !values.has('playwright-module') || !values.has('artifacts-directory')) {
    throw new Error('--playwright-module=<절대 경로>와 --artifacts-directory=<절대 경로>가 필요합니다.');
  }
  const playwrightModule = values.get('playwright-module');
  const artifactsDirectory = values.get('artifacts-directory');
  if (!isAbsolute(playwrightModule) || !isAbsolute(artifactsDirectory)) {
    throw new Error('Playwright와 아티팩트 경로는 절대 경로여야 합니다.');
  }
  const rel = relative(root, resolve(artifactsDirectory));
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) {
    throw new Error('아티팩트 경로는 체크아웃 밖이어야 합니다.');
  }
  return { playwrightModule, artifactsDirectory };
}

async function run(command, args, timeoutMs = 120000) {
  const child = spawn(command, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], shell: false });
  let output = '';
  const append = (chunk) => { output = (output + chunk.toString()).slice(-12000); };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  const timeout = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
  try {
    const [code, signal] = await once(child, 'close');
    if (code !== 0) throw new Error(`${command} ${args.join(' ')} 실패 (${signal ?? code})\n${output}`);
    return output.trim();
  } finally {
    clearTimeout(timeout);
  }
}

async function stage(name, work) {
  const time = Date.now();
  try {
    const result = await work();
    stages.push({ name, status: 'passed', durationMs: Date.now() - time });
    return result;
  } catch (error) {
    stages.push({ name, status: 'failed', durationMs: Date.now() - time, error: String(error?.message ?? error) });
    throw error;
  }
}

async function freePort() {
  const listener = createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise((res, rej) => listener.close((error) => error ? rej(error) : res()));
  return port;
}

async function startServer(dataFile) {
  const port = await freePort();
  const child = spawn(process.execPath, ['server/main.mjs'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), RESTART_QUEST_DATA_FILE: dataFile },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false
  });
  server = child;
  let output = '';
  child.stdout.on('data', (chunk) => { output = (output + chunk.toString()).slice(-4000); });
  child.stderr.on('data', (chunk) => { output = (output + chunk.toString()).slice(-4000); });
  const base = `http://127.0.0.1:${port}`;
  const until = Date.now() + 12000;
  while (Date.now() < until) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(`서버가 시작 전에 종료되었습니다: ${output}`);
    try {
      const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok && (await response.json()).status === 'ok') return base;
    } catch { /* 시작 대기 */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`서버 시작 제한 시간을 초과했습니다: ${output}`);
}

async function stopServer() {
  if (!server) return;
  const child = server;
  server = undefined;
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  const timeout = setTimeout(() => child.kill('SIGKILL'), 4000);
  try { await once(child, 'close'); } finally { clearTimeout(timeout); }
}

async function api(base, path, body, method = 'POST') {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(5000)
  });
  assert.match(response.headers.get('content-type') ?? '', /^application\/json/);
  return { status: response.status, body: await response.json() };
}

async function expectError(base, path, body, status, code, method = 'POST') {
  const result = await api(base, path, body, method);
  assert.equal(result.status, status, `${path}: HTTP 상태`);
  assert.equal(result.body.error?.code, code, `${path}: 오류 코드`);
  assert.ok(typeof result.body.error?.message === 'string' && result.body.error.message.length > 0);
}

async function dashboard(base) {
  const result = await api(base, '/api/dashboard', undefined, 'GET');
  assert.equal(result.status, 200);
  return result.body;
}

async function assertStored(dataFile, current) {
  const stored = JSON.parse(await readFile(dataFile, 'utf8'));
  assert.equal(stored.schemaVersion, 1);
  assert.equal(stored.quests.length, current.quests.length);
  assert.deepEqual(
    Object.fromEntries(stored.quests.map((quest) => [quest.id, quest])),
    Object.fromEntries(current.quests.map((quest) => [quest.id, quest]))
  );
}

async function httpFlow(base, dataFile) {
  assert.deepEqual((await dashboard(base)).summary, { total: 0, pending: 0, completed: 0, failed: 0, redesigned: 0 });
  for (const input of [
    { availableMinutes: 4, currentState: 'ready' },
    { availableMinutes: 121, currentState: 'ready' },
    { availableMinutes: '20', currentState: 'ready' },
    { availableMinutes: 10.5, currentState: 'ready' },
    { availableMinutes: 20, currentState: 'unknown' },
    { availableMinutes: 20, currentState: 'ready', extra: true }
  ]) await expectError(base, '/api/quests', input, 400, 'VALIDATION_ERROR');
  await expectError(base, '/api/quests/missing/complete', {}, 404, 'NOT_FOUND');
  await expectError(base, '/api/quests', undefined, 405, 'METHOD_NOT_ALLOWED', 'GET');

  const first = await api(base, '/api/quests', { availableMinutes: 20, currentState: 'ready' });
  assert.equal(first.status, 201);
  assert.equal(first.body.quest.level, 3);
  assert.equal(first.body.quest.status, 'pending');
  await assertStored(dataFile, await dashboard(base));
  const firstId = first.body.quest.id;
  const done = await api(base, `/api/quests/${firstId}/complete`, {});
  assert.equal(done.status, 200);
  assert.equal(done.body.quest.status, 'completed');
  assert.ok(done.body.quest.completedAt);
  await expectError(base, `/api/quests/${firstId}/complete`, {}, 409, 'INVALID_STATE');
  await expectError(base, `/api/quests/${firstId}/fail`, { reasonCode: 'time' }, 409, 'INVALID_STATE');
  await expectError(base, `/api/quests/${firstId}/redesign`, {}, 409, 'INVALID_STATE');

  const parent = await api(base, '/api/quests', { availableMinutes: 10, currentState: 'low_energy' });
  assert.equal(parent.status, 201);
  const parentId = parent.body.quest.id;
  await expectError(base, `/api/quests/${parentId}/fail`, { reasonCode: 'invalid' }, 400, 'VALIDATION_ERROR');
  await expectError(base, `/api/quests/${parentId}/fail`, { reasonCode: 'time', reasonNote: 42 }, 400, 'VALIDATION_ERROR');
  await expectError(base, `/api/quests/${parentId}/fail`, { reasonCode: 'time', reasonNote: '가'.repeat(201) }, 400, 'VALIDATION_ERROR');
  const failed = await api(base, `/api/quests/${parentId}/fail`, { reasonCode: 'time', reasonNote: '  회의가 길어짐  ' });
  assert.equal(failed.status, 200);
  assert.deepEqual(failed.body.quest.failureReason, { code: 'time', note: '회의가 길어짐' });
  assertSuggestedAction(failed.body.suggestion, parent.body.quest, 'time');
  await expectError(base, `/api/quests/${parentId}/fail`, { reasonCode: 'energy' }, 409, 'INVALID_STATE');
  await expectError(base, `/api/quests/${parentId}/complete`, {}, 409, 'INVALID_STATE');
  const suggested = await dashboard(base);
  assert.deepEqual(suggested.suggestions.find((item) => item.parentId === parentId), failed.body.suggestion);
  assert.equal(suggested.summary.total, 2);
  await assertStored(dataFile, suggested);
  const redesigned = await api(base, `/api/quests/${parentId}/redesign`, {});
  assert.equal(redesigned.status, 201);
  const child = redesigned.body.quest;
  assertConfirmedAction(child, parent.body.quest, failed.body.suggestion);
  assert.equal(redesigned.body.parentQuest.status, 'failed');
  await expectError(base, `/api/quests/${parentId}/redesign`, {}, 409, 'ALREADY_REDESIGNED');
  assert.equal((await api(base, `/api/quests/${child.id}/complete`, {})).status, 200);

  const minimumParent = await api(base, '/api/quests', { availableMinutes: 5, currentState: 'overwhelmed' });
  assert.equal(minimumParent.status, 201);
  const minimumId = minimumParent.body.quest.id;
  assert.equal((await api(base, `/api/quests/${minimumId}/fail`, { reasonCode: 'too_hard' })).status, 200);
  const minimumChild = await api(base, `/api/quests/${minimumId}/redesign`, {});
  assert.equal(minimumChild.status, 201);
  assert.equal(minimumChild.body.quest.level, 0);
  const smallest = await api(base, `/api/quests/${minimumChild.body.quest.id}/fail`, { reasonCode: 'energy' });
  assert.equal(smallest.status, 200);
  assert.equal(smallest.body.suggestion, null);
  await expectError(base, `/api/quests/${minimumChild.body.quest.id}/redesign`, {}, 409, 'MINIMUM_STEP');

  const pending = await api(base, '/api/quests', { availableMinutes: 5, currentState: 'ready' });
  assert.equal(pending.status, 201);
  const current = await dashboard(base);
  assert.deepEqual(current.summary, { total: 6, pending: 1, completed: 2, failed: 3, redesigned: 2 });
  assert.deepEqual(current.nextActions.map((quest) => quest.id), [pending.body.quest.id]);
  assert.deepEqual(current.suggestions, []);
  await assertStored(dataFile, current);
  return current;
}

async function reasonMatrixFlow(base, dataFile) {
  const reasons = Object.keys(expectedRedesigns);
  const inputs = [
    { body: { availableMinutes: 20, currentState: 'ready' }, level: 3 },
    { body: { availableMinutes: 10, currentState: 'ready' }, level: 2 },
    { body: { availableMinutes: 5, currentState: 'overwhelmed' }, level: 1 }
  ];
  const confirmed = [];
  for (const input of inputs) {
    const titles = new Set();
    const instructions = new Set();
    for (const reasonCode of reasons) {
      const created = await api(base, '/api/quests', input.body);
      assert.equal(created.status, 201);
      const parent = created.body.quest;
      assert.equal(parent.level, input.level);
      const failed = await api(base, `/api/quests/${parent.id}/fail`, { reasonCode });
      assert.equal(failed.status, 200);
      assert.equal(failed.body.quest.failureReason.code, reasonCode);
      const suggestion = failed.body.suggestion;
      assertSuggestedAction(suggestion, parent, reasonCode);
      titles.add(suggestion.title);
      instructions.add(suggestion.instruction);
      const beforeConfirmation = await dashboard(base);
      assert.deepEqual(beforeConfirmation.suggestions.find((item) => item.parentId === parent.id), suggestion);
      const redesigned = await api(base, `/api/quests/${parent.id}/redesign`, {});
      assert.equal(redesigned.status, 201);
      assertConfirmedAction(redesigned.body.quest, parent, suggestion);
      assert.equal(redesigned.body.parentQuest.status, 'failed');
      confirmed.push(redesigned.body.quest);
      const afterConfirmation = await dashboard(base);
      assert.deepEqual(afterConfirmation.quests.find((item) => item.id === redesigned.body.quest.id), redesigned.body.quest);
      assert.equal(afterConfirmation.suggestions.some((item) => item.parentId === parent.id), false);
      await assertStored(dataFile, afterConfirmation);
    }
    assert.equal(titles.size, reasons.length, `level ${input.level}: 이유별 제목`);
    assert.equal(instructions.size, reasons.length, `level ${input.level}: 이유별 지시문`);
  }
  const current = await dashboard(base);
  assert.equal(confirmed.length, inputs.length * reasons.length);
  for (const child of confirmed) {
    assert.deepEqual(current.quests.find((item) => item.id === child.id), child);
    assert.deepEqual(current.nextActions.find((item) => item.id === child.id), child);
  }
  await assertStored(dataFile, current);
  return current;
}

async function screenshot(page, name) {
  const path = join(runDirectory, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  screenshots.push(path);
}

async function waitSummary(page, key, value) {
  await page.waitForFunction(
    ({ key, value }) => document.getElementById(`summary${key}`)?.textContent === String(value),
    { key, value },
    { timeout: 10000 }
  );
}

async function assertNoOverflow(page) {
  const size = await page.evaluate(() => ({ width: window.innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(size.scroll <= size.width, `모바일 가로 넘침: ${size.scroll}px > ${size.width}px`);
}

async function assertRenderedSuggestion(page, suggestion) {
  const panel = page.locator(`#suggestion-${suggestion.parentId}`);
  await panel.waitFor();
  assert.equal(await panel.locator('h4').textContent(), `${suggestion.title} · ${suggestion.minutes}분`);
  assert.equal(await panel.locator('p').nth(1).textContent(), suggestion.instruction);
}

async function assertRenderedQuest(page, selector, quest) {
  const card = page.locator(selector);
  await card.waitFor();
  assert.equal(await card.locator('h3').textContent(), quest.title);
  assert.equal(await card.locator('.quest-instruction').textContent(), quest.instruction);
}

async function browserFlow(base, width, name) {
  const context = await browser.newContext({ viewport: { width, height: 850 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  activePage = page;
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  try {
    await page.goto(base, { waitUntil: 'networkidle' });
    let current = await dashboard(base);
    await waitSummary(page, 'Total', current.summary.total);
    assert.equal(await page.locator('#mainContent').getAttribute('aria-busy'), 'false');
    if (width === 375) await assertNoOverflow(page);
    await screenshot(page, `${name}-initial`);

    let known = new Set(current.quests.map((quest) => quest.id));
    await page.locator('#availableMinutes').fill('20');
    await page.locator('#currentState').selectOption('ready');
    await page.locator('#createQuestForm button[type="submit"]').click();
    await waitSummary(page, 'Total', current.summary.total + 1);
    current = await dashboard(base);
    const doneQuest = current.quests.find((quest) => !known.has(quest.id));
    assert.ok(doneQuest && doneQuest.status === 'pending');
    assert.ok((await page.locator(`#action-${doneQuest.id}`).textContent()).includes(doneQuest.title));
    await page.locator(`#action-${doneQuest.id} .card-actions .secondary-button`).click();
    await waitSummary(page, 'Completed', current.summary.completed + 1);
    assert.match(await page.locator(`#history-${doneQuest.id}`).textContent(), /완료한 시간/);

    const examples = [];
    const titles = new Set();
    const instructions = new Set();
    for (const { reasonCode, note } of [
      { reasonCode: 'unclear', note: '다음 행동이 모호했어요' },
      { reasonCode: 'time', note: '시간이 모자랐어요' }
    ]) {
      current = await dashboard(base);
      known = new Set(current.quests.map((quest) => quest.id));
      await page.locator('#availableMinutes').fill('10');
      await page.locator('#currentState').selectOption('low_energy');
      await page.locator('#createQuestForm button[type="submit"]').click();
      await waitSummary(page, 'Total', current.summary.total + 1);
      current = await dashboard(base);
      const parent = current.quests.find((quest) => !known.has(quest.id));
      assert.ok(parent && parent.status === 'pending');
      assert.equal(parent.level, 2);
      await page.locator(`#action-${parent.id} .card-actions .outline-button`).click();
      await page.locator(`#reason-${parent.id}`).selectOption(reasonCode);
      await page.locator(`#note-${parent.id}`).fill(note);
      await page.locator(`#failure-${parent.id} button[type="submit"]`).click();
      await waitSummary(page, 'Failed', current.summary.failed + 1);
      current = await dashboard(base);
      const suggestion = current.suggestions.find((item) => item.parentId === parent.id);
      assert.ok(suggestion);
      assertSuggestedAction(suggestion, parent, reasonCode);
      titles.add(suggestion.title);
      instructions.add(suggestion.instruction);
      await assertRenderedSuggestion(page, suggestion);
      assert.match(
        await page.locator(`#suggestion-${parent.id}`).textContent(),
        reasonCode === 'unclear' ? /할 일을 구체적인 한 단계로 좁혔어요/ : /필요 시간을 줄였어요/
      );
      assert.match(await page.locator(`#history-${parent.id}`).textContent(), new RegExp(note));
      if (width === 375) await assertNoOverflow(page);
      await screenshot(page, `${name}-${reasonCode}-suggestion`);

      await page.reload({ waitUntil: 'networkidle' });
      await waitSummary(page, 'Total', current.summary.total);
      await assertRenderedSuggestion(page, suggestion);
      assert.deepEqual((await dashboard(base)).suggestions.find((item) => item.parentId === parent.id), suggestion);
      await page.locator(`#suggestion-${parent.id} button`).click();
      await waitSummary(page, 'Redesigned', current.summary.redesigned + 1);
      const afterRedesign = await dashboard(base);
      const child = afterRedesign.quests.find((quest) => quest.parentId === parent.id);
      assert.ok(child && child.status === 'pending');
      assertConfirmedAction(child, parent, suggestion);
      await assertRenderedQuest(page, `#action-${child.id}`, child);
      assert.match(await page.locator(`#action-${child.id}`).textContent(), /원래 퀘스트 → 새 행동/);
      assert.match(
        await page.locator(`#action-${child.id}`).textContent(),
        reasonCode === 'unclear' ? /무엇을 할지 명확하지 않았어요/ : /시간이 부족했어요/
      );
      await screenshot(page, `${name}-${reasonCode}-action`);
      examples.push({ parent, child, suggestion, note, completed: reasonCode === 'unclear' });

      if (reasonCode === 'unclear') {
        await page.locator(`#action-${child.id} .card-actions .secondary-button`).click();
        await waitSummary(page, 'Completed', afterRedesign.summary.completed + 1);
        assert.match(await page.locator(`#history-${child.id}`).textContent(), /완료한 시간/);
      }
    }
    assert.equal(titles.size, 2, `${name}: 같은 단계의 이유별 제목`);
    assert.equal(instructions.size, 2, `${name}: 같은 단계의 이유별 지시문`);

    const persisted = await dashboard(base);
    await page.reload({ waitUntil: 'networkidle' });
    await waitSummary(page, 'Total', persisted.summary.total);
    assert.equal(await page.locator('#summaryCompleted').textContent(), String(persisted.summary.completed));
    assert.equal(await page.locator('#summaryFailed').textContent(), String(persisted.summary.failed));
    assert.equal(await page.locator('#summaryRedesigned').textContent(), String(persisted.summary.redesigned));
    assert.equal(await page.locator(`#history-${doneQuest.id}`).count(), 1);
    for (const { parent, child, note, completed } of examples) {
      assert.equal(await page.locator(`#history-${parent.id}`).count(), 1);
      await assertRenderedQuest(page, `#history-${child.id}`, child);
      assert.match(await page.locator(`#history-${parent.id}`).textContent(), new RegExp(note));
      assert.match(await page.locator(`#history-${child.id}`).textContent(), /원래 퀘스트 → 새 행동/);
      if (completed) {
        assert.equal(await page.locator(`#action-${child.id}`).count(), 0);
        assert.match(await page.locator(`#history-${child.id}`).textContent(), /완료한 시간/);
      } else {
        await assertRenderedQuest(page, `#action-${child.id}`, child);
      }
    }
    if (width === 375) await assertNoOverflow(page);
    await screenshot(page, `${name}-completed`);

    const beforeError = await dashboard(base);
    await page.route('**/api/quests', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'STORAGE_ERROR', message: '검증용 저장 오류' } }) });
      } else await route.continue();
    });
    await page.locator('#availableMinutes').fill('30');
    await page.locator('#createQuestForm button[type="submit"]').click();
    await page.locator('#errorBanner:not([hidden])').waitFor();
    assert.match(await page.locator('#errorMessage').textContent(), /검증용 저장 오류/);
    assert.equal(await page.locator('#summaryTotal').textContent(), String(beforeError.summary.total));
    assert.deepEqual(await dashboard(base), beforeError);
    await screenshot(page, `${name}-api-error`);
    assert.deepEqual(pageErrors, []);
    return { width, name, examples, doneQuestId: doneQuest.id };
  } catch (error) {
    try { await screenshot(page, `${name}-failure`); } catch { /* 페이지가 이미 닫혔을 수 있음 */ }
    throw error;
  } finally {
    activePage = undefined;
    await context.close();
  }
}

async function browserRestartFlow(base, { width, name, examples, doneQuestId }) {
  const context = await browser.newContext({ viewport: { width, height: 850 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  activePage = page;
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  try {
    await page.goto(base, { waitUntil: 'networkidle' });
    const current = await dashboard(base);
    await waitSummary(page, 'Total', current.summary.total);
    assert.equal(await page.locator(`#history-${doneQuestId}`).count(), 1);
    for (const { parent, child, suggestion, note, completed } of examples) {
      const storedParent = current.quests.find((quest) => quest.id === parent.id);
      const storedChild = current.quests.find((quest) => quest.id === child.id);
      assert.ok(storedParent && storedChild);
      assert.equal(storedParent.failureReason.code, suggestion.reasonCode);
      assert.equal(storedParent.failureReason.note, note);
      assertConfirmedAction(storedChild, storedParent, suggestion);
      assert.equal(storedChild.status, completed ? 'completed' : 'pending');
      await assertRenderedQuest(page, `#history-${child.id}`, storedChild);
      if (completed) {
        assert.equal(await page.locator(`#action-${child.id}`).count(), 0);
      } else {
        await assertRenderedQuest(page, `#action-${child.id}`, storedChild);
      }
    }
    if (width === 375) await assertNoOverflow(page);
    await screenshot(page, `${name}-restarted`);
    assert.deepEqual(pageErrors, []);
  } catch (error) {
    try { await screenshot(page, `${name}-restart-failure`); } catch { /* 페이지가 이미 닫혔을 수 있음 */ }
    throw error;
  } finally {
    activePage = undefined;
    await context.close();
  }
}

async function main() {
  let failure;
  try {
    const { playwrightModule, artifactsDirectory } = options(process.argv.slice(2));
    runDirectory = join(artifactsDirectory, `restart-quest-${Date.now()}-${process.pid}`);
    await mkdir(runDirectory, { recursive: true });
    const gitSha = await run('git', ['rev-parse', 'HEAD'], 10000);
    assert.match(gitSha, /^[0-9a-f]{40}$/);
    sha = gitSha;
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'restart-quest-verify-'));
    const dataFile = join(temporaryDirectory, 'quests.json');

    await stage('의존성 준비', () => run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--no-audit', '--no-fund'], 180000));
    await stage('API 회귀 테스트', () => run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['test'], 180000));
    const playwright = await stage('Playwright 로드', async () => {
      const module = await import(pathToFileURL(playwrightModule).href);
      assert.ok(module.chromium?.launch, 'Playwright Chromium이 없습니다.');
      return module;
    });
    let base = await stage('서버 시작', () => startServer(dataFile));
    await stage('실제 HTTP와 저장 파일', () => httpFlow(base, dataFile));
    const beforeRestart = await stage('같은 단계의 실패 이유별 HTTP 행동', () => reasonMatrixFlow(base, dataFile));
    await writeFile(join(runDirectory, 'http-dashboard.json'), JSON.stringify(beforeRestart, null, 2) + '\n');
    dashboards.push(join(runDirectory, 'http-dashboard.json'));
    await stage('서버 재시작과 영속성', async () => {
      await stopServer();
      base = await startServer(dataFile);
      assert.deepEqual(await dashboard(base), beforeRestart);
      await assertStored(dataFile, beforeRestart);
    });
    browser = await stage('실제 Chromium 시작', () => playwright.chromium.launch({ headless: true }));
    const desktop = await stage('데스크톱 브라우저 핵심 흐름', () => browserFlow(base, 1280, 'desktop'));
    const mobile = await stage('375px 모바일 브라우저 핵심 흐름', () => browserFlow(base, 375, 'mobile'));
    await stage('브라우저 기록의 서버 재시작과 영속성', async () => {
      const beforeBrowserRestart = await dashboard(base);
      await stopServer();
      base = await startServer(dataFile);
      assert.deepEqual(await dashboard(base), beforeBrowserRestart);
      await assertStored(dataFile, beforeBrowserRestart);
      await browserRestartFlow(base, desktop);
      await browserRestartFlow(base, mobile);
    });
    await stage('최종 저장 파일', async () => {
      const finalDashboard = await dashboard(base);
      await assertStored(dataFile, finalDashboard);
      await writeFile(join(runDirectory, 'final-dashboard.json'), JSON.stringify(finalDashboard, null, 2) + '\n');
      dashboards.push(join(runDirectory, 'final-dashboard.json'));
    });
  } catch (error) {
    failure = error;
    if (activePage && runDirectory) {
      try { await screenshot(activePage, 'failure'); } catch { /* 브라우저 종료 시 촬영 불가 */ }
    }
  } finally {
    try { await browser?.close(); } catch (error) { failure ??= error; }
    try { await stopServer(); } catch (error) { failure ??= error; }
    try { if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true }); } catch (error) { failure ??= error; }
    if (runDirectory) {
      const result = {
        headSha: sha,
        command: [process.execPath, ...process.argv.slice(1)],
        startedAt,
        finishedAt: new Date().toISOString(),
        status: failure ? 'failed' : 'passed',
        stages,
        screenshots,
        dashboards,
        artifactsDirectory: runDirectory,
        failure: failure ? String(failure.message ?? failure) : null
      };
      await writeFile(join(runDirectory, 'result.json'), JSON.stringify(result, null, 2) + '\n');
      process.stdout.write(`${result.status}: ${join(runDirectory, 'result.json')}\n`);
    }
  }
  if (failure) throw failure;
}

async function stopOnSignal(code) {
  try { await browser?.close(); } catch { /* 종료 계속 */ }
  try { await stopServer(); } finally { process.exit(code); }
}

process.on('SIGINT', () => { void stopOnSignal(130); });
process.on('SIGTERM', () => { void stopOnSignal(143); });

main().catch((error) => {
  process.stderr.write(`검증 실패: ${error.message ?? error}\n`);
  process.exitCode = 1;
});
