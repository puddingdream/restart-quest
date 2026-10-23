import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../server/main.mjs';

async function closeServer(server) {
  server.closeAllConnections();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'restart-quest-test-'));
  const dataFile = join(directory, 'data', 'quests.json');
  const servers = [];
  t.after(async () => {
    for (const server of servers) if (server.listening) await closeServer(server);
    await rm(directory, { recursive: true, force: true });
  });
  async function boot(options = {}) {
    const server = await startServer({ port: 0, dataFile, ...options });
    servers.push(server);
    return { server, base: `http://127.0.0.1:${server.address().port}` };
  }
  return { directory, dataFile, boot };
}

async function request(base, path, body, method = 'POST') {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

async function errorIs(base, path, body, status, code, method = 'POST') {
  const result = await request(base, path, body, method);
  assert.equal(result.status, status);
  assert.equal(result.body.error.code, code);
  assert.equal(typeof result.body.error.message, 'string');
  assert.ok(result.body.error.message.length > 0);
}

test('HTTP 핵심 흐름은 디스크 저장 후 응답하고 서버 재시작 뒤 그대로 복원된다', async (t) => {
  const { dataFile, boot } = await fixture(t);
  const first = await boot();
  const health = await request(first.base, '/api/health', undefined, 'GET');
  assert.deepEqual(health, { status: 200, body: { status: 'ok' } });

  const completed = await request(first.base, '/api/quests', { availableMinutes: 20, currentState: 'ready' });
  assert.equal(completed.status, 201);
  assert.equal(completed.body.quest.level, 3);
  assert.equal(completed.body.quest.minutes, 20);
  const completedId = completed.body.quest.id;
  assert.equal((await request(first.base, `/api/quests/${completedId}/complete`)).status, 200);

  const initial = await request(first.base, '/api/quests', { availableMinutes: 10, currentState: 'low_energy' });
  assert.equal(initial.status, 201);
  const parentId = initial.body.quest.id;
  const failed = await request(first.base, `/api/quests/${parentId}/fail`, { reasonCode: 'time', reasonNote: '  회의가 길어짐  ' });
  assert.equal(failed.status, 200);
  assert.deepEqual(failed.body.quest.failureReason, { code: 'time', note: '회의가 길어짐' });
  assert.equal(failed.body.suggestion.parentId, parentId);
  assert.equal(failed.body.suggestion.reasonCode, 'time');
  assert.ok(failed.body.suggestion.minutes < failed.body.quest.minutes);
  const beforeConfirm = await request(first.base, '/api/dashboard', undefined, 'GET');
  assert.deepEqual(beforeConfirm.body.suggestions, [failed.body.suggestion]);
  assert.equal(beforeConfirm.body.summary.total, 2);

  const redesigned = await request(first.base, `/api/quests/${parentId}/redesign`);
  assert.equal(redesigned.status, 201);
  const child = redesigned.body.quest;
  assert.equal(child.parentId, parentId);
  assert.equal(child.rootId, initial.body.quest.rootId);
  assert.equal(child.level, initial.body.quest.level - 1);
  assert.ok(child.minutes < initial.body.quest.minutes);
  assert.equal(child.redesignReason, 'time');
  assert.equal(redesigned.body.parentQuest.status, 'failed');
  assert.equal((await request(first.base, `/api/quests/${child.id}/complete`)).status, 200);
  const pending = await request(first.base, '/api/quests', { availableMinutes: 5, currentState: 'overwhelmed' });
  assert.equal(pending.status, 201);

  const stored = JSON.parse(await readFile(dataFile, 'utf8'));
  assert.equal(stored.schemaVersion, 1);
  assert.equal(stored.quests.length, 4);
  assert.deepEqual(stored.quests.map((quest) => quest.status).sort(), ['completed', 'completed', 'failed', 'pending']);
  const dashboard = await request(first.base, '/api/dashboard', undefined, 'GET');
  assert.deepEqual(dashboard.body.summary, { total: 4, pending: 1, completed: 2, failed: 1, redesigned: 1 });
  assert.deepEqual(dashboard.body.nextActions.map((quest) => quest.id), [pending.body.quest.id]);
  assert.deepEqual(dashboard.body.suggestions, []);

  await closeServer(first.server);
  const second = await boot();
  const afterRestart = await request(second.base, '/api/dashboard', undefined, 'GET');
  assert.deepEqual(afterRestart.body, dashboard.body);
});

test('입력 오류, 없는 ID, 종료 상태 충돌과 HTTP 메서드를 구분한다', async (t) => {
  const { boot } = await fixture(t);
  const { base } = await boot();
  for (const body of [
    { availableMinutes: 4, currentState: 'ready' },
    { availableMinutes: 121, currentState: 'ready' },
    { availableMinutes: '20', currentState: 'ready' },
    { availableMinutes: 20.5, currentState: 'ready' },
    { availableMinutes: 20, currentState: 'tired' },
    { availableMinutes: 20, currentState: 'ready', extra: true }
  ]) await errorIs(base, '/api/quests', body, 400, 'VALIDATION_ERROR');
  await errorIs(base, '/api/quests', undefined, 400, 'VALIDATION_ERROR');
  await errorIs(base, '/api/quests', undefined, 405, 'METHOD_NOT_ALLOWED', 'GET');
  await errorIs(base, '/api/quests/no-such-id/complete', {}, 404, 'NOT_FOUND');
  await errorIs(base, '/api/quests/no-such-id/fail', { reasonCode: 'time' }, 404, 'NOT_FOUND');

  const raw = await fetch(`${base}/api/quests`, { method: 'POST', body: '{bad' });
  assert.equal(raw.status, 400);
  assert.equal((await raw.json()).error.code, 'VALIDATION_ERROR');
  const large = await fetch(`${base}/api/quests`, { method: 'POST', body: 'x'.repeat(1024 * 1024 + 1) });
  assert.equal(large.status, 413);
  assert.equal((await large.json()).error.code, 'PAYLOAD_TOO_LARGE');

  const created = await request(base, '/api/quests', { availableMinutes: 5, currentState: 'overwhelmed' });
  const id = created.body.quest.id;
  for (const body of [{ reasonCode: 'bad' }, { reasonCode: 'time', reasonNote: 1 }, { reasonCode: 'time', extra: true }, { reasonCode: 'time', reasonNote: '가'.repeat(201) }]) {
    await errorIs(base, `/api/quests/${id}/fail`, body, 400, 'VALIDATION_ERROR');
  }
  await errorIs(base, `/api/quests/${id}/complete`, { extra: true }, 400, 'VALIDATION_ERROR');
  assert.equal((await request(base, `/api/quests/${id}/complete`, {})).status, 200);
  await errorIs(base, `/api/quests/${id}/complete`, {}, 409, 'INVALID_STATE');
  await errorIs(base, `/api/quests/${id}/fail`, { reasonCode: 'time' }, 409, 'INVALID_STATE');
  await errorIs(base, `/api/quests/${id}/redesign`, {}, 409, 'INVALID_STATE');

  const other = await request(base, '/api/quests', { availableMinutes: 5, currentState: 'ready' });
  const otherId = other.body.quest.id;
  assert.equal((await request(base, `/api/quests/${otherId}/fail`, { reasonCode: 'energy' })).status, 200);
  await errorIs(base, `/api/quests/${otherId}/fail`, { reasonCode: 'energy' }, 409, 'INVALID_STATE');
  await errorIs(base, `/api/quests/${otherId}/complete`, {}, 409, 'INVALID_STATE');
});

test('중복 재설계는 한 번만 저장하고 최소 단계에서 제안을 멈춘다', async (t) => {
  const { boot } = await fixture(t);
  const { base } = await boot();
  const created = await request(base, '/api/quests', { availableMinutes: 5, currentState: 'overwhelmed' });
  const id = created.body.quest.id;
  assert.equal((await request(base, `/api/quests/${id}/fail`, { reasonCode: 'too_hard' })).status, 200);
  const attempts = await Promise.all([request(base, `/api/quests/${id}/redesign`), request(base, `/api/quests/${id}/redesign`)]);
  assert.deepEqual(attempts.map((result) => result.status).sort(), [201, 409]);
  assert.equal(attempts.find((result) => result.status === 409).body.error.code, 'ALREADY_REDESIGNED');
  const child = attempts.find((result) => result.status === 201).body.quest;
  assert.equal(child.level, 0);
  const minimum = await request(base, `/api/quests/${child.id}/fail`, { reasonCode: 'time' });
  assert.equal(minimum.status, 200);
  assert.equal(minimum.body.suggestion, null);
  await errorIs(base, `/api/quests/${child.id}/redesign`, {}, 409, 'MINIMUM_STEP');
  const dashboard = await request(base, '/api/dashboard', undefined, 'GET');
  assert.equal(dashboard.body.summary.total, 2);
  assert.deepEqual(dashboard.body.suggestions, []);
});

test('기록 실패를 성공으로 응답하지 않고 손상된 저장 파일로 시작하지 않는다', async (t) => {
  const { directory, boot } = await fixture(t);
  const blockingPath = join(directory, 'blocking-parent');
  const { base } = await boot({ dataFile: join(blockingPath, 'quests.json') });
  await writeFile(blockingPath, 'ordinary file');
  await errorIs(base, '/api/quests', { availableMinutes: 10, currentState: 'ready' }, 500, 'STORAGE_ERROR');
  await rm(blockingPath);
  const dashboard = await request(base, '/api/dashboard', undefined, 'GET');
  assert.equal(dashboard.body.summary.total, 0);

  const corruptFile = join(directory, 'corrupt.json');
  await writeFile(corruptFile, '{broken');
  await assert.rejects(startServer({ port: 0, dataFile: corruptFile }));
  await writeFile(corruptFile, JSON.stringify({ schemaVersion: 99, quests: [] }));
  await assert.rejects(startServer({ port: 0, dataFile: corruptFile }));
});

test('같은 출처에서 화면 자산을 제공하고 알 수 없는 경로는 거부한다', async (t) => {
  const { directory, boot } = await fixture(t);
  const publicDir = join(directory, 'public');
  await mkdir(publicDir);
  await writeFile(join(publicDir, 'index.html'), '<!doctype html><title>Quest</title>');
  await writeFile(join(publicDir, 'app.js'), 'document.title = "Quest";');
  await writeFile(join(publicDir, 'style.css'), 'body { color: blue; }');
  const { base } = await boot({ publicDir });
  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /^text\/html/);
  assert.match(await page.text(), /Quest/);
  for (const [path, contentType] of [['/app.js', 'text/javascript'], ['/style.css', 'text/css']]) {
    const asset = await fetch(`${base}${path}`);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), new RegExp(`^${contentType}`));
  }
  await errorIs(base, '/app.js', {}, 405, 'METHOD_NOT_ALLOWED');
  const missing = await fetch(`${base}/../../private.txt`);
  assert.equal(missing.status, 404);
});

test('실행 중 저장 파일이 사라지면 이전 이력을 빈 저장소로 덮어쓰지 않는다', async (t) => {
  const { dataFile, boot } = await fixture(t);
  const { base } = await boot();
  assert.equal((await request(base, '/api/quests', { availableMinutes: 10, currentState: 'ready' })).status, 201);
  await rm(dataFile);
  await errorIs(base, '/api/dashboard', undefined, 500, 'STORAGE_ERROR', 'GET');
  await errorIs(base, '/api/quests', { availableMinutes: 20, currentState: 'ready' }, 500, 'STORAGE_ERROR');
});
