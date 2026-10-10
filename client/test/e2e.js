import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rename, rmdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const clientDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const repoDir = resolve(clientDir, '..');
const serverEntry = join(repoDir, 'server', 'index.js');
const delay = (ms) => new Promise((done) => setTimeout(done, ms));

async function waitFor(check, label, timeout = 12000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      if (error.launchFailure) throw error;
      // Navigation can briefly detach the execution context.
    }
    await delay(80);
  }
  throw new Error(`Timed out: ${label}`);
}

function waitForExit(child, timeout = 5000) {
  return new Promise((done) => {
    const timer = setTimeout(() => done(false), timeout);
    child.closePromise.then(() => { clearTimeout(timer); done(true); });
  });
}

async function stopProcess(child) {
  if (!child) return;
  if (child.exitCode === null && child.signalCode === null) child.kill();
  if (await waitForExit(child)) return;
  child.kill('SIGKILL');
  if (!(await waitForExit(child))) throw new Error('Child process did not exit');
}

async function startServer(dataFile) {
  const env = {
    ...process.env,
    PORT: '0',
    QUEST_DATA_FILE: dataFile,
    QUEST_PUBLIC_DIR: join(clientDir, 'dist'),
  };
  const server = spawn(process.execPath, [serverEntry], {
    cwd: repoDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  server.closePromise = new Promise((done) => server.once('close', done));
  let output = '';
  let launchError;
  server.stdout.setEncoding('utf8').on('data', (chunk) => { output += chunk; });
  server.stderr.resume();
  server.on('error', (error) => { launchError = error; });
  try {
    const port = await waitFor(() => {
      if (launchError) { launchError.launchFailure = true; throw launchError; }
      if (server.exitCode !== null || server.signalCode !== null) {
        const error = new Error(`Server exited with code ${server.exitCode}`);
        error.launchFailure = true;
        throw error;
      }
      return /listening on http:\/\/127\.0\.0\.1:(\d+)/.exec(output)?.[1];
    }, 'server startup');
    return { server, origin: `http://127.0.0.1:${port}` };
  } catch (error) {
    try { await stopProcess(server); }
    catch (cleanupError) { console.error('Server cleanup also failed:', cleanupError); }
    throw error;
  }
}

class BrowserPage {
  constructor(socket) {
    this.socket = socket;
    this.id = 0;
    this.pending = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
    socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) pending.reject(new Error('Browser connection closed'));
      this.pending.clear();
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((done, fail) => {
      this.pending.set(id, { resolve: done, reject: fail });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }
  async navigate(url) {
    await this.evaluate('window.__questNavigationMarker = true');
    await this.send('Page.navigate', { url });
    await waitFor(() => this.evaluate(`location.href === ${JSON.stringify(url)} && window.__questNavigationMarker !== true && document.readyState === 'complete' && !!document.getElementById('quest-form')`), 'browser navigation');
  }
  close() { this.socket.close(); }
}

async function startBrowser(profile) {
  const executable = process.env.CHROME_PATH ?? (process.platform === 'win32'
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : 'chromium');
  const chrome = spawn(executable, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, '--window-size=1280,900', 'about:blank',
  ], { stdio: 'ignore', windowsHide: true });
  chrome.closePromise = new Promise((done) => chrome.once('close', done));
  let launchError;
  chrome.on('error', (error) => { launchError = error; });
  try {
    const port = await waitFor(async () => {
      if (launchError) { launchError.launchFailure = true; throw launchError; }
      if (chrome.exitCode !== null || chrome.signalCode !== null) {
        const error = new Error(`Chrome exited with code ${chrome.exitCode}`);
        error.launchFailure = true;
        throw error;
      }
      try { return Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); }
      catch { return 0; }
    }, 'Chrome DevTools port');
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const target = targets.find((entry) => entry.type === 'page');
    assert.ok(target, 'browser page target');
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((done, fail) => {
      const timer = setTimeout(() => fail(new Error('Timed out: browser WebSocket')), 12000);
      socket.addEventListener('open', () => { clearTimeout(timer); done(); }, { once: true });
      socket.addEventListener('error', (error) => { clearTimeout(timer); fail(error); }, { once: true });
    });
    const page = new BrowserPage(socket);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    return { chrome, page };
  } catch (error) {
    try { await stopProcess(chrome); }
    catch (cleanupError) { console.error('Browser cleanup also failed:', cleanupError); }
    throw error;
  }
}

async function screenshot(page, name) {
  const directory = join(clientDir, 'dist', 'verification');
  await mkdir(directory, { recursive: true });
  const result = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await writeFile(join(directory, name), Buffer.from(result.data, 'base64'));
}

const cardExpression = (id) =>
  `document.querySelector('#quest-list li[data-quest-id=' + ${JSON.stringify(JSON.stringify(id))} + ']')`;

async function clickAction(page, id, label) {
  await page.evaluate(`(() => {
    const card = ${cardExpression(id)};
    const button = [...(card?.querySelectorAll('button') ?? [])]
      .find((candidate) => candidate.textContent.trim() === ${JSON.stringify(label)});
    if (!button || button.disabled) throw new Error('Action unavailable: ${label}');
    button.click();
    return true;
  })()`);
}

async function selectReason(page, id, reason) {
  assert.equal(await page.evaluate(`(() => {
    const select = ${cardExpression(id)}?.querySelector('select');
    if (!select) throw new Error('Failure reason select unavailable');
    select.value = ${JSON.stringify(reason)};
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return select.value;
  })()`), reason);
}

async function createInBrowser(page, minutes, energy, knownIds) {
  await page.evaluate(`(() => {
    document.getElementById('available-minutes').value = ${JSON.stringify(String(minutes))};
    document.getElementById('energy').value = ${JSON.stringify(energy)};
    document.getElementById('quest-form').requestSubmit();
  })()`);
  return waitFor(() => page.evaluate(`(() => {
    if (document.getElementById('result-section').hidden) return null;
    return [...document.querySelectorAll('#quest-list li')]
      .map((card) => card.dataset.questId)
      .find((id) => !${JSON.stringify(knownIds)}.includes(id)) ?? null;
  })()`), `browser quest creation (${energy}, ${minutes} minutes)`);
}

async function getQuests(origin) {
  const response = await fetch(`${origin}/api/quests`);
  assert.equal(response.status, 200);
  return (await response.json()).quests;
}

async function getHistory(origin, id) {
  const response = await fetch(`${origin}/api/quests/${id}/history`);
  assert.equal(response.status, 200);
  return response.json();
}

async function postJson(origin, path, body) {
  const response = await fetch(`${origin}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function assertRejectedUnchanged(origin, dataFile, path, input, status, code, field) {
  const beforeFile = await readFile(dataFile, 'utf8');
  const beforeList = await getQuests(origin);
  const result = await postJson(origin, path, input);
  assert.equal(result.status, status, `${path} HTTP status`);
  assert.equal(result.body.error?.code, code, `${path} error code`);
  assert.equal(typeof result.body.error?.message, 'string');
  assert.ok(result.body.error?.fields && typeof result.body.error.fields === 'object');
  if (field) assert.ok(result.body.error.fields[field], `${path} error field ${field}`);
  assert.deepEqual(await getQuests(origin), beforeList, `${path} changed the in-memory list`);
  assert.equal(await readFile(dataFile, 'utf8'), beforeFile, `${path} changed the saved snapshot`);
}

function assertSavedSnapshot(text, quests) {
  const snapshot = JSON.parse(text);
  assert.equal(snapshot.schemaVersion, 1);
  assert.deepEqual(snapshot.quests.map((quest) => quest.id).sort(), quests.map((quest) => quest.id).sort());
  for (const quest of quests) {
    assert.deepEqual(snapshot.quests.find((entry) => entry.id === quest.id), quest);
  }
}

await access(serverEntry).catch(() => {
  throw new Error('Integrated server/index.js is required. Run test:e2e after server and client are combined.');
});
// A clean verification checkout has no dist; build the assets used by this server.
await import('../scripts/build.js');
await access(join(clientDir, 'dist', 'index.html'));

const dataDir = await mkdtemp(join(tmpdir(), 'restart-quest-e2e-data-'));
const profile = await mkdtemp(join(tmpdir(), 'restart-quest-e2e-browser-'));
const dataFile = join(dataDir, 'quests.json');
let running;
let browser;
let originalError;
try {
  running = await startServer(dataFile);
  const initial = await fetch(`${running.origin}/api/quests`);
  assert.equal(initial.status, 200);
  assert.deepEqual((await initial.json()).quests, []);
  const documentResponse = await fetch(`${running.origin}/`);
  assert.equal(documentResponse.status, 200);
  assert.match(await documentResponse.text(), /src="\/app\.js"/);
  for (const [path, contentType] of [['/app.js', 'javascript'], ['/styles.css', 'css']]) {
    const assetResponse = await fetch(`${running.origin}${path}`);
    assert.equal(assetResponse.status, 200, `${path} is served from the built public directory`);
    assert.match(assetResponse.headers.get('content-type') ?? '', new RegExp(contentType));
    assert.ok((await assetResponse.text()).length > 0, `${path} is not empty`);
  }

  browser = await startBrowser(profile);
  await browser.page.navigate(`${running.origin}/`);
  await waitFor(() => browser.page.evaluate("!document.getElementById('empty-state').hidden"), 'empty list in browser');
  await browser.page.evaluate("document.getElementById('available-minutes').value = '20'; document.getElementById('energy').value = 'medium'; document.getElementById('quest-form').requestSubmit()");
  const id = await waitFor(() => browser.page.evaluate("!document.getElementById('result-section').hidden && document.querySelector('#quest-list li')?.dataset.questId"), 'created quest and stored list');
  const saved = await (await fetch(`${running.origin}/api/quests`)).json();
  assert.equal(saved.quests.length, 1);
  assert.equal(saved.quests[0].id, id);
  assert.equal(saved.quests[0].energy, 'medium');
  assert.ok(saved.quests[0].estimatedMinutes <= 20);
  assert.equal(await browser.page.evaluate("document.getElementById('result-quest-title').textContent"), saved.quests[0].title);
  await screenshot(browser.page, 'e2e-desktop.png');

  await browser.page.evaluate("document.getElementById('available-minutes').value = '4'; document.getElementById('quest-form').requestSubmit()");
  await waitFor(() => browser.page.evaluate("!document.getElementById('form-error').hidden && document.getElementById('result-section').hidden"), 'success then invalid browser input');
  assert.equal(await browser.page.evaluate("document.querySelector('#quest-list li')?.dataset.questId"), id);
  await screenshot(browser.page, 'e2e-desktop-error.png');

  await browser.page.evaluate('window.__questReloadMarker = true');
  await browser.page.send('Page.reload', { ignoreCache: true });
  await waitFor(() => browser.page.evaluate(`window.__questReloadMarker !== true && document.querySelector('#quest-list li')?.dataset.questId === '${id}'`), 'stored list after reload');
  const invalid = await fetch(`${running.origin}/api/quests`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ availableMinutes: 4, energy: 'medium' }),
  });
  assert.equal(invalid.status, 400);
  const invalidBody = await invalid.json();
  assert.equal(invalidBody.error.code, 'INVALID_INPUT');
  assert.ok(invalidBody.error.fields.availableMinutes);
  assert.equal((await (await fetch(`${running.origin}/api/quests`)).json()).quests.length, 1);

  await stopProcess(running.server);
  running = undefined;
  running = await startServer(dataFile);
  const restored = await (await fetch(`${running.origin}/api/quests`)).json();
  assert.deepEqual(restored.quests, saved.quests);
  await browser.page.navigate(`${running.origin}/`);
  await waitFor(() => browser.page.evaluate(`document.querySelector('#quest-list li')?.dataset.questId === '${id}'`), 'stored list after server restart');
  assert.equal(await browser.page.evaluate("document.querySelector('#quest-list h3')?.textContent"), saved.quests[0].title);

  await browser.page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const mobile = await browser.page.evaluate("({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, formWidth: document.getElementById('quest-form').getBoundingClientRect().width, buttonWidth: document.getElementById('create-button').getBoundingClientRect().width, listCount: document.querySelectorAll('#quest-list li').length })");
  assert.ok(mobile.scrollWidth <= mobile.width + 1, `mobile horizontal overflow: ${JSON.stringify(mobile)}`);
  assert.ok(mobile.formWidth > 200 && mobile.buttonWidth > 200 && mobile.listCount === 1, 'mobile form and stored quest remain usable');
  await browser.page.evaluate("document.getElementById('available-minutes').value = '5'; document.getElementById('energy').value = 'low'; document.getElementById('quest-form').requestSubmit()");
  const mobileId = await waitFor(() => browser.page.evaluate(`[...document.querySelectorAll('#quest-list li')].find((item) => item.dataset.questId !== '${id}')?.dataset.questId`), 'mobile quest creation');
  const mobileSaved = await (await fetch(`${running.origin}/api/quests`)).json();
  assert.equal(mobileSaved.quests.length, 2);
  const createdOnMobile = mobileSaved.quests.find((quest) => quest.id === mobileId);
  assert.ok(createdOnMobile);
  assert.ok(createdOnMobile.estimatedMinutes <= 5);
  await screenshot(browser.page, 'e2e-mobile.png');

  await browser.page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  assert.equal(await browser.page.evaluate('innerWidth'), 1280);
  await assertRejectedUnchanged(running.origin, dataFile, '/api/quests',
    { availableMinutes: 4, energy: 'medium' }, 400, 'INVALID_INPUT', 'availableMinutes');
  await assertRejectedUnchanged(running.origin, dataFile, `/api/quests/${id}/fail`,
    { failureReason: 'unknown' }, 400, 'INVALID_INPUT', 'failureReason');
  await clickAction(browser.page, id, '완료 기록');
  await waitFor(() => browser.page.evaluate(`${cardExpression(id)}?.querySelector('.quest-state')?.textContent.includes('완료 기록 ·')`), 'completed quest in desktop browser');
  const completed = (await getQuests(running.origin)).find((quest) => quest.id === id);
  assert.equal(completed.status, 'completed');
  assert.ok(completed.completedAt);
  assert.equal(completed.failureReason, null);
  assert.equal(completed.failedAt, null);
  assert.equal(await browser.page.evaluate(`${cardExpression(id)}?.querySelectorAll('button').length`), 2,
    'completed quest must not expose another state action');
  const completedHistory = await getHistory(running.origin, id);
  assert.equal(completedHistory.rootQuestId, id);
  assert.deepEqual(completedHistory.quests, [completed]);
  await clickAction(browser.page, id, '이력 보기');
  await waitFor(() => browser.page.evaluate(`${cardExpression(id)}?.querySelector('.quest-history:not([hidden])')?.textContent.includes(${JSON.stringify(id)})`), 'completed history in browser');
  for (const [action, body] of [['complete', {}], ['fail', { failureReason: 'time_shortage' }]]) {
    await assertRejectedUnchanged(running.origin, dataFile, `/api/quests/${id}/${action}`,
      body, 409, 'QUEST_ALREADY_RESOLVED');
  }
  await assertRejectedUnchanged(running.origin, dataFile, `/api/quests/${id}/redesign`,
    {}, 409, 'QUEST_NOT_FAILED');

  const reasons = {
    time_shortage: { label: '시간이 부족했어요', minutes: 10, title: '짧게 시작하기' },
    low_energy: { label: '지금은 에너지가 부족했어요', minutes: 13, title: '자료 한 가지 준비하기' },
    unclear_start: { label: '어디서 시작할지 막막했어요', minutes: 6, title: '첫 단서 한 줄 적기' },
  };
  const knownIds = [id, mobileId];
  const chains = {};
  for (const [reason, expected] of Object.entries(reasons)) {
    const parentId = await createInBrowser(browser.page, 20, 'medium', knownIds);
    knownIds.push(parentId);
    const pending = (await getQuests(running.origin)).find((quest) => quest.id === parentId);
    assert.equal(pending.status, 'pending');
    assert.equal(pending.estimatedMinutes, 20);
    await assertRejectedUnchanged(running.origin, dataFile, `/api/quests/${parentId}/fail`,
      { failureReason: 'other' }, 400, 'INVALID_INPUT', 'failureReason');
    await selectReason(browser.page, parentId, reason);
    await clickAction(browser.page, parentId, '실패 기록');
    await waitFor(() => browser.page.evaluate(`${cardExpression(parentId)}?.querySelector('.quest-state')?.textContent.includes(${JSON.stringify(expected.label)})`), `${reason} recorded in browser`);
    const failed = (await getQuests(running.origin)).find((quest) => quest.id === parentId);
    assert.equal(failed.status, 'failed');
    assert.equal(failed.failureReason, reason);
    assert.ok(failed.failedAt);
    assert.equal(failed.completedAt, null);
    await assertRejectedUnchanged(running.origin, dataFile, `/api/quests/${parentId}/fail`,
      { failureReason: reason }, 409, 'QUEST_ALREADY_RESOLVED');
    await assertRejectedUnchanged(running.origin, dataFile, `/api/quests/${parentId}/complete`,
      {}, 409, 'QUEST_ALREADY_RESOLVED');
    await clickAction(browser.page, parentId, '더 작은 행동 제안');
    await waitFor(() => browser.page.evaluate(`${cardExpression(parentId)}?.querySelector('.quest-history:not([hidden])')?.textContent.includes('루트 ID: ${parentId}')`), `${reason} redesign history in browser`);
    const child = (await getQuests(running.origin)).find((quest) => quest.parentQuestId === parentId);
    assert.ok(child, `${reason} child saved`);
    knownIds.push(child.id);
    assert.equal(child.title, expected.title);
    assert.equal(child.estimatedMinutes, expected.minutes);
    assert.ok(child.estimatedMinutes < failed.estimatedMinutes);
    assert.equal(child.parentQuestId, parentId);
    assert.equal(child.rootQuestId, parentId);
    assert.equal(child.status, 'pending');
    assert.deepEqual((await getQuests(running.origin)).find((quest) => quest.id === parentId), failed,
      'redesign must preserve the failed parent');
    const history = await getHistory(running.origin, child.id);
    assert.equal(history.rootQuestId, parentId);
    assert.deepEqual(history.quests, [failed, child]);
    assert.deepEqual(await getHistory(running.origin, parentId), history);
    assert.equal(await browser.page.evaluate(`${cardExpression(parentId)}?.querySelector('.quest-history')?.textContent.includes(${JSON.stringify(child.id)})`), true);
    assert.equal(await browser.page.evaluate(`${cardExpression(child.id)}?.textContent.includes(${JSON.stringify(parentId)})`), true);
    await assertRejectedUnchanged(running.origin, dataFile, `/api/quests/${parentId}/redesign`,
      {}, 409, 'QUEST_ALREADY_REDESIGNED');
    await assertRejectedUnchanged(running.origin, dataFile, `/api/quests/${child.id}/redesign`,
      {}, 409, 'QUEST_NOT_FAILED');
    chains[reason] = { parentId, childId: child.id };
  }
  await screenshot(browser.page, 'e2e-desktop-record.png');

  // A stale card receives a real 409 after another HTTP client confirms the quest.
  const conflictId = chains.unclear_start.childId;
  const externalCompletion = await postJson(running.origin, `/api/quests/${conflictId}/complete`, {});
  assert.equal(externalCompletion.status, 200);
  const beforeConflict = await getQuests(running.origin);
  const beforeConflictFile = await readFile(dataFile, 'utf8');
  await clickAction(browser.page, conflictId, '완료 기록');
  await waitFor(() => browser.page.evaluate(`${cardExpression(conflictId)}?.querySelector('.notice-error:not([hidden])')?.textContent.includes('이미 기록된 퀘스트')`), 'real 409 shown on stale browser card');
  assert.equal(await browser.page.evaluate(`${cardExpression(conflictId)}?.querySelector('.quest-state')?.textContent.includes('완료 기록 ·')`), true);
  assert.deepEqual(await getQuests(running.origin), beforeConflict);
  assert.equal(await readFile(dataFile, 'utf8'), beforeConflictFile);

  // Force a real persistence failure using only the isolated E2E data path.
  const persistenceQuestId = chains.time_shortage.childId;
  const beforePersistenceFailure = await getQuests(running.origin);
  const beforePersistenceFile = await readFile(dataFile, 'utf8');
  const backupFile = join(dataDir, 'quests-backup.json');
  await rename(dataFile, backupFile);
  try {
    await mkdir(dataFile);
    await clickAction(browser.page, persistenceQuestId, '완료 기록');
    await waitFor(() => browser.page.evaluate(`${cardExpression(persistenceQuestId)}?.querySelector('.notice-error:not([hidden])')?.textContent.includes('저장에 실패')`), 'real 503 in browser');
    assert.equal(await browser.page.evaluate(`${cardExpression(persistenceQuestId)}?.querySelector('.quest-state')?.textContent`), '진행할 수 있는 행동');
    assert.deepEqual(await getQuests(running.origin), beforePersistenceFailure);
    assert.equal(await readFile(backupFile, 'utf8'), beforePersistenceFile);
  } finally {
    await rmdir(dataFile).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    await rename(backupFile, dataFile);
  }
  assertSavedSnapshot(await readFile(dataFile, 'utf8'), await getQuests(running.origin));
  await screenshot(browser.page, 'e2e-desktop-persistence-error.png');

  await browser.page.send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
  });
  const mobileControls = await browser.page.evaluate(`(() => {
    const card = ${cardExpression(mobileId)};
    const select = card.querySelector('select');
    const buttons = [...card.querySelectorAll('button:not([hidden])')];
    const rects = [select, ...buttons].map((node) => node.getBoundingClientRect());
    return {
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      controlWidths: rects.map((rect) => rect.width),
      withinViewport: rects.every((rect) => rect.left >= 0 && rect.right <= innerWidth + 1),
      failDisabledBeforeReason: buttons.find((button) => button.textContent.trim() === '실패 기록')?.disabled,
    };
  })()`);
  assert.equal(mobileControls.width, 390);
  assert.ok(mobileControls.scrollWidth <= 391 && mobileControls.withinViewport,
    `mobile controls overflow: ${JSON.stringify(mobileControls)}`);
  assert.ok(mobileControls.controlWidths.every((width) => width > 200),
    `mobile controls too narrow: ${JSON.stringify(mobileControls)}`);
  assert.equal(mobileControls.failDisabledBeforeReason, true);
  await selectReason(browser.page, mobileId, 'time_shortage');
  await clickAction(browser.page, mobileId, '실패 기록');
  await waitFor(() => browser.page.evaluate(`${cardExpression(mobileId)}?.querySelector('.quest-state')?.textContent.includes('시간이 부족했어요')`), 'mobile failure record');
  await clickAction(browser.page, mobileId, '더 작은 행동 제안');
  await waitFor(() => browser.page.evaluate(`${cardExpression(mobileId)}?.querySelector('.quest-history:not([hidden])')?.textContent.includes('루트 ID: ${mobileId}')`), 'mobile redesign history');
  const mobileChild = (await getQuests(running.origin)).find((quest) => quest.parentQuestId === mobileId);
  assert.equal(mobileChild.estimatedMinutes, 2);
  assert.equal(mobileChild.rootQuestId, mobileId);
  assert.equal(await browser.page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), true);
  assert.equal(await browser.page.evaluate(`${cardExpression(mobileChild.id)}?.textContent.includes(${JSON.stringify(mobileId)})`), true);
  await screenshot(browser.page, 'e2e-mobile-record.png');

  // A descendant can be reduced to one minute; another redesign must be rejected.
  await selectReason(browser.page, mobileChild.id, 'unclear_start');
  await clickAction(browser.page, mobileChild.id, '실패 기록');
  await waitFor(() => browser.page.evaluate(`${cardExpression(mobileChild.id)}?.querySelector('.quest-state')?.textContent.includes('어디서 시작할지 막막했어요')`), 'mobile child failure record');
  await clickAction(browser.page, mobileChild.id, '더 작은 행동 제안');
  await waitFor(() => browser.page.evaluate(`${cardExpression(mobileChild.id)}?.querySelector('.quest-history:not([hidden])')?.textContent.includes('루트 ID: ${mobileId}')`), 'mobile descendant history');
  const lastChild = (await getQuests(running.origin)).find((quest) => quest.parentQuestId === mobileChild.id);
  assert.equal(lastChild.estimatedMinutes, 1);
  assert.equal(lastChild.rootQuestId, mobileId);
  assert.deepEqual((await getHistory(running.origin, lastChild.id)).quests.map((quest) => quest.id),
    [mobileId, mobileChild.id, lastChild.id]);
  await selectReason(browser.page, lastChild.id, 'low_energy');
  await clickAction(browser.page, lastChild.id, '실패 기록');
  await waitFor(() => browser.page.evaluate(`${cardExpression(lastChild.id)}?.textContent.includes('지금은 1분짜리 행동입니다')`), 'one-minute boundary in browser');
  assert.equal(await browser.page.evaluate(`${cardExpression(lastChild.id)}?.textContent.includes('더 작은 행동 제안')`), false);
  await assertRejectedUnchanged(running.origin, dataFile, `/api/quests/${lastChild.id}/redesign`,
    {}, 409, 'REDESIGN_LIMIT_REACHED');
  assertSavedSnapshot(await readFile(dataFile, 'utf8'), await getQuests(running.origin));

  // Reload and process restart must both recover the same confirmed records.
  const beforeReload = await getQuests(running.origin);
  await browser.page.evaluate('window.__questReloadMarker = true');
  await browser.page.send('Page.reload', { ignoreCache: true });
  await waitFor(() => browser.page.evaluate(`window.__questReloadMarker !== true && ${cardExpression(lastChild.id)}?.textContent.includes('지금은 1분짜리 행동입니다')`), 'confirmed records after reload');
  assert.equal(await browser.page.evaluate(`${cardExpression(id)}?.querySelector('.quest-state')?.textContent.includes('완료 기록 ·')`), true);
  await clickAction(browser.page, mobileChild.id, '이력 보기');
  await waitFor(() => browser.page.evaluate(`${cardExpression(mobileChild.id)}?.querySelector('.quest-history:not([hidden])')?.textContent.includes(${JSON.stringify(lastChild.id)})`), 'descendant history after reload');

  await stopProcess(running.server);
  running = undefined;
  await clickAction(browser.page, chains.low_energy.childId, '완료 기록');
  await waitFor(() => browser.page.evaluate("!document.getElementById('list-error').hidden && !document.getElementById('retry-button').hidden"), 'disconnected API error in browser');
  assert.equal(await browser.page.evaluate("document.getElementById('list-error').textContent.includes('요청 결과를 확인하지 못했습니다')"), true);
  assert.equal(await browser.page.evaluate("document.querySelectorAll('#quest-list li').length"), 0,
    'disconnected list must not look like a confirmed success');
  running = await startServer(dataFile);
  assert.deepEqual(await getQuests(running.origin), beforeReload);
  assertSavedSnapshot(await readFile(dataFile, 'utf8'), beforeReload);
  assert.deepEqual((await getHistory(running.origin, lastChild.id)).quests.map((quest) => quest.id),
    [mobileId, mobileChild.id, lastChild.id]);
  await browser.page.navigate(`${running.origin}/`);
  await waitFor(() => browser.page.evaluate(`${cardExpression(lastChild.id)}?.textContent.includes('지금은 1분짜리 행동입니다')`), 'stored records after process restart');
  assert.equal(await browser.page.evaluate(`${cardExpression(chains.low_energy.childId)}?.querySelector('.quest-state')?.textContent`), '진행할 수 있는 행동');
  assert.equal(await browser.page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), true);
  console.log(`PASS real server e2e: create, complete, three failure reasons and redesign histories, immutable 400/409 and real 503, disconnect, reload, process restart, desktop 1280px and mobile 390px; ${beforeReload.length} saved quests`);
} catch (error) {
  originalError = error;
  throw error;
} finally {
  const cleanupErrors = [];
  try { browser?.page.close(); } catch (error) { cleanupErrors.push(error); }
  for (const child of [browser?.chrome, running?.server]) {
    try { await stopProcess(child); } catch (error) { cleanupErrors.push(error); }
  }
  for (const directory of [profile, dataDir]) {
    try { await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
    catch (error) { cleanupErrors.push(error); }
  }
  if (cleanupErrors.length) {
    if (originalError) console.error('E2E cleanup also failed:', cleanupErrors);
    else throw new AggregateError(cleanupErrors, 'E2E cleanup failed');
  }
}
