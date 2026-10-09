import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
  const server = spawn(process.execPath, [serverEntry], {
    cwd: repoDir,
    env: { ...process.env, PORT: '0', QUEST_DATA_FILE: dataFile, QUEST_PUBLIC_DIR: clientDir },
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

await access(serverEntry).catch(() => {
  throw new Error('Integrated server/index.js is required. Run test:e2e after server and client are combined.');
});

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

  await browser.page.evaluate('window.__questReloadMarker = true');
  await browser.page.send('Page.reload', { ignoreCache: true });
  await waitFor(() => browser.page.evaluate(`window.__questReloadMarker !== true && document.querySelector('#quest-list li')?.dataset.questId === '${id}'`), 'stored list after reload');
  await browser.page.evaluate("document.getElementById('available-minutes').value = '4'; document.getElementById('quest-form').requestSubmit()");
  await waitFor(() => browser.page.evaluate("!document.getElementById('form-error').hidden && document.getElementById('result-section').hidden"), 'invalid browser input');
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
  console.log(`PASS real server e2e: POST/GET, reload, invalid input, process restart, desktop 1280px, mobile 390px; quests ${id}, ${mobileId}`);
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
