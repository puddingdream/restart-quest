import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const fixture = JSON.parse(await readFile(new URL('./fixtures/quest-api-v1.json', import.meta.url), 'utf8'));
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
let quests = [];
let failNextPost = false;
let postCount = 0;

function sendJson(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname === '/api/quests') {
    if (request.method === 'GET') return sendJson(response, 200, { quests });
    if (request.method === 'POST') {
      postCount++;
      if (failNextPost) {
        failNextPost = false;
        return sendJson(response, 503, fixture.persistenceError);
      }
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!Number.isInteger(input.availableMinutes) || input.availableMinutes < 5 || input.availableMinutes > 120 ||
          !['low', 'medium', 'high'].includes(input.energy)) {
        return sendJson(response, 400, fixture.invalidInput);
      }
      const quest = { ...fixture.quest, id: randomUUID(), availableMinutes: input.availableMinutes,
        energy: input.energy, estimatedMinutes: Math.min(input.availableMinutes, fixture.quest.estimatedMinutes) };
      quest.rootQuestId = quest.id;
      quests = [quest, ...quests];
      return sendJson(response, 201, { quest });
    }
  }
  const name = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!['index.html', 'styles.css', 'app.js', 'quest-app.js'].includes(name)) {
    response.writeHead(404).end();
    return;
  }
  const ext = name.slice(name.lastIndexOf('.'));
  response.writeHead(200, { 'Content-Type': `${types[ext]}; charset=utf-8`, 'Cache-Control': 'no-store' });
  response.end(await readFile(join(root, name)));
});

function browserPath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  if (process.platform === 'win32') return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  return 'chromium';
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(check, description, timeout = 12000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      if (error.chromeLaunch) throw error;
      // Navigation can briefly detach the execution context.
    }
    await delay(80);
  }
  throw new Error(`Timed out: ${description}`);
}

class DevTools {
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
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }
  close() { this.socket.close(); }
}

const profile = await mkdtemp(join(tmpdir(), 'restart-quest-browser-'));
let chrome;
let chromeClosed;
let devtools;
let originalError;
try {
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const url = `http://127.0.0.1:${server.address().port}/`;
  chrome = spawn(browserPath(), [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, '--window-size=1280,900', 'about:blank',
  ], { stdio: 'ignore', windowsHide: true });
  chromeClosed = new Promise((resolveClose) => chrome.once('close', resolveClose));
  let launchError;
  chrome.on('error', (error) => { launchError = error; });
  chrome.on('exit', (code) => { launchError = new Error(`Chrome exited with code ${code}`); });
  const port = await waitFor(async () => {
    if (launchError) {
      launchError.chromeLaunch = true;
      throw launchError;
    }
    try {
      return Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]);
    } catch { return 0; }
  }, 'Chrome DevTools port');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = targets.find((entry) => entry.type === 'page');
  assert.ok(target, 'browser page target');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => {
    socket.addEventListener('open', resolveOpen, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  devtools = new DevTools(socket);
  await devtools.send('Page.enable');
  await devtools.send('Runtime.enable');
  await devtools.send('Page.navigate', { url });
  await waitFor(() => devtools.evaluate("document.readyState === 'complete' && !document.getElementById('empty-state').hidden"), 'empty list');
  assert.equal(postCount, 0);

  await devtools.evaluate("document.getElementById('available-minutes').value = '20'; document.getElementById('energy').value = 'medium'; document.getElementById('quest-form').requestSubmit()");
  const savedId = await waitFor(() => devtools.evaluate("!document.getElementById('result-section').hidden && document.querySelector('#quest-list li')?.dataset.questId"), 'POST result and GET list');
  assert.equal(postCount, 1);
  assert.equal(quests[0].id, savedId);
  assert.ok(quests[0].estimatedMinutes <= 20);

  const screenshotDir = join(root, 'dist', 'verification');
  await mkdir(screenshotDir, { recursive: true });
  await writeFile(join(screenshotDir, 'desktop.png'), Buffer.from((await devtools.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));

  await devtools.evaluate('window.__beforeReload = true');
  await devtools.send('Page.reload', { ignoreCache: true });
  await waitFor(() => devtools.evaluate(`window.__beforeReload !== true && document.querySelector('#quest-list li')?.dataset.questId === '${savedId}' && document.querySelector('#quest-list h3')?.textContent === ${JSON.stringify(fixture.quest.title)}`), 'reload persisted list');

  failNextPost = true;
  await devtools.evaluate("document.getElementById('quest-form').requestSubmit()");
  await waitFor(() => devtools.evaluate("!document.getElementById('form-error').hidden && document.getElementById('result-section').hidden"), '503 error without success');
  assert.equal(postCount, 2);
  assert.equal(quests.length, 1);

  await devtools.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  const mobile = await devtools.evaluate("({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, formWidth: document.getElementById('quest-form').getBoundingClientRect().width, buttonWidth: document.getElementById('create-button').getBoundingClientRect().width })");
  assert.ok(mobile.scrollWidth <= mobile.width + 1, `mobile horizontal overflow: ${JSON.stringify(mobile)}`);
  assert.ok(mobile.buttonWidth > 200 && mobile.formWidth > 200, 'mobile controls remain usable');
  await writeFile(join(screenshotDir, 'mobile.png'), Buffer.from((await devtools.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).data, 'base64'));
  console.log(`PASS browser smoke: empty, POST/GET, reload ID ${savedId}, 503, desktop 1280px, mobile 390px; screenshots in dist/verification/`);
} catch (error) {
  originalError = error;
  throw error;
} finally {
  const cleanupErrors = [];
  try { devtools?.close(); } catch (error) { cleanupErrors.push(error); }
  if (chrome) {
    if (chrome.exitCode === null && chrome.signalCode === null) chrome.kill();
    const waitClosed = (timeout) => new Promise((resolveWait) => {
      const timer = setTimeout(() => resolveWait(false), timeout);
      chromeClosed.then(() => { clearTimeout(timer); resolveWait(true); });
    });
    if (await waitClosed(5000) === false) {
      chrome.kill('SIGKILL');
      if (await waitClosed(5000) === false) {
        cleanupErrors.push(new Error('Chrome did not exit after termination'));
      }
    }
  }
  if (server.listening) {
    try {
      await new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
    } catch (error) { cleanupErrors.push(error); }
  }
  try {
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch (error) { cleanupErrors.push(error); }
  if (cleanupErrors.length) {
    if (originalError) console.error('Browser cleanup also failed:', cleanupErrors);
    else throw new AggregateError(cleanupErrors, 'Browser cleanup failed');
  }
}
