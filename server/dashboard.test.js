import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rename, rm, rmdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { createQuestServer } from './app.js';
import { projectDashboard } from './dashboard.js';
import { createQuestStore } from './store.js';

const ids = {
  A: '11111111-1111-4111-8111-111111111111',
  B: '22222222-2222-4222-8222-222222222222',
  C: '33333333-3333-4333-8333-333333333333',
  D: '44444444-4444-4444-8444-444444444444',
  E: '55555555-5555-4555-8555-555555555555',
  F: '66666666-6666-4666-8666-666666666666',
  G: '77777777-7777-4777-8777-777777777777',
};

function quest(name, createdAt, status, minutes, options = {}) {
  return {
    id: ids[name], createdAt, availableMinutes: options.availableMinutes ?? minutes,
    energy: 'medium', title: `행동 ${name}`, description: `행동 ${name}을 한다.`,
    estimatedMinutes: minutes, status,
    failureReason: status === 'failed' ? options.failureReason ?? 'time_shortage' : null,
    completedAt: status === 'completed' ? `${createdAt.slice(0, 17)}30.000Z` : null,
    failedAt: status === 'failed' ? `${createdAt.slice(0, 17)}40.000Z` : null,
    parentQuestId: options.parent ? ids[options.parent] : null,
    rootQuestId: options.root ? ids[options.root] : ids[name],
  };
}

function complexSnapshot() {
  return { schemaVersion: 1, quests: [
    quest('A', '2026-10-09T09:00:00.000Z', 'failed', 10),
    quest('B', '2026-10-09T10:02:00.000Z', 'pending', 5, { parent: 'A', root: 'A', availableMinutes: 10 }),
    quest('C', '2026-10-09T10:00:00.000Z', 'completed', 5),
    quest('D', '2026-10-09T10:01:00.000Z', 'failed', 5, { failureReason: 'unclear_start' }),
    quest('E', '2026-10-09T10:02:00.000Z', 'pending', 5),
    quest('F', '2026-10-09T10:01:30.000Z', 'failed', 1, { parent: 'D', root: 'D', availableMinutes: 5, failureReason: 'low_energy' }),
  ] };
}

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'restart-dashboard-test-'));
  assert.ok(resolve(directory).startsWith(`${resolve(tmpdir())}${sep}`));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { dataFile: join(directory, 'data', 'quests.json'), publicDir: join(directory, 'public') };
}

async function listen(t, options) {
  const server = await createQuestServer(options);
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  t.after(() => new Promise((done) => server.close(done)));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

async function getDashboard(base) {
  const response = await fetch(`${base}/api/dashboard`);
  return { status: response.status, type: response.headers.get('content-type'),
    cache: response.headers.get('cache-control'), body: await response.json() };
}

async function post(base, path, body) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

test('빈 저장소의 HTTP 대시보드는 0건과 생성 행동이며 조회가 저장하지 않는다', async (t) => {
  const options = await fixture(t);
  const { base } = await listen(t, options);
  const result = await getDashboard(base);
  assert.equal(result.status, 200);
  assert.equal(result.type, 'application/json; charset=utf-8');
  assert.equal(result.cache, 'no-store');
  assert.deepEqual(result.body, {
    counts: { pending: 0, completed: 0, failed: 0, redesigned: 0 },
    histories: [], nextAction: { kind: 'create', questId: null, rootQuestId: null },
  });
  await assert.rejects(readFile(options.dataFile, 'utf8'), { code: 'ENOENT' });
  const invalidMethod = await fetch(`${base}/api/dashboard`, { method: 'POST' });
  assert.equal(invalidMethod.status, 405);
  assert.equal(invalidMethod.headers.get('allow'), 'GET');
  assert.deepEqual(await invalidMethod.json(), { error: {
    code: 'METHOD_NOT_ALLOWED', message: '지원하지 않는 요청 방식입니다.', fields: {},
  } });
  await assert.rejects(readFile(options.dataFile, 'utf8'), { code: 'ENOENT' });
});

test('복합 v1 스냅샷의 상태·연결 순서·동률 우선순위가 HTTP 및 재시작 후 동일하다', async (t) => {
  const options = await fixture(t);
  const source = complexSnapshot();
  await mkdir(dirname(options.dataFile), { recursive: true });
  await writeFile(options.dataFile, JSON.stringify(source));
  const beforeFile = await readFile(options.dataFile, 'utf8');
  const store = await createQuestStore(options.dataFile);
  const beforeMemory = store.list();
  const first = await listen(t, options);
  const result = await getDashboard(first.base);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.counts, { pending: 2, completed: 1, failed: 3, redesigned: 2 });
  assert.deepEqual(result.body.histories.map((item) => item.rootQuestId),
    ['E', 'D', 'C', 'A'].map((name) => ids[name]));
  assert.deepEqual(result.body.histories.map((item) => item.quests.map((itemQuest) => itemQuest.id)),
    [['E'], ['D', 'F'], ['C'], ['A', 'B']].map((chain) => chain.map((name) => ids[name])));
  assert.deepEqual(result.body.histories.flatMap((item) => item.quests),
    [source.quests[4], source.quests[3], source.quests[5], source.quests[2], source.quests[0], source.quests[1]]);
  assert.deepEqual(result.body.nextAction,
    { kind: 'resume', questId: ids.B, rootQuestId: ids.A });
  assert.deepEqual(store.dashboard(), result.body);
  assert.deepEqual(store.list(), beforeMemory);
  assert.equal(await readFile(options.dataFile, 'utf8'), beforeFile);
  await new Promise((done) => first.server.close(done));
  const second = await listen(t, options);
  assert.deepEqual((await getDashboard(second.base)).body, result.body);
  assert.equal(await readFile(options.dataFile, 'utf8'), beforeFile);
});

test('다음 행동은 끝 자손의 상태와 1분 한계를 기준으로 선택한다', () => {
  const source = complexSnapshot();
  for (const name of ['B', 'E']) {
    const item = source.quests.find((entry) => entry.id === ids[name]);
    item.status = 'completed';
    item.completedAt = '2026-10-09T11:00:00.000Z';
  }
  assert.deepEqual(projectDashboard(source).nextAction,
    { kind: 'rest_or_create', questId: ids.F, rootQuestId: ids.D });
  source.quests.push(quest('G', '2026-10-09T08:00:00.000Z', 'failed', 5));
  assert.deepEqual(projectDashboard(source).nextAction,
    { kind: 'redesign', questId: ids.G, rootQuestId: ids.G });
  source.quests = source.quests.filter((entry) => ![ids.D, ids.F, ids.G].includes(entry.id));
  assert.deepEqual(projectDashboard(source).nextAction,
    { kind: 'create', questId: null, rootQuestId: null });
});

test('실제 전이·재설계만 집계에 반영하고 중복·저장 실패 뒤 확정 상태를 유지한다', async (t) => {
  const options = await fixture(t);
  const { base } = await listen(t, options);
  const completedRoot = await post(base, '/api/quests', { availableMinutes: 5, energy: 'low' });
  assert.equal(completedRoot.status, 201);
  assert.deepEqual((await getDashboard(base)).body.counts,
    { pending: 1, completed: 0, failed: 0, redesigned: 0 });
  assert.equal((await getDashboard(base)).body.nextAction.questId, completedRoot.body.quest.id);
  const completed = await post(base, `/api/quests/${completedRoot.body.quest.id}/complete`, {});
  assert.equal(completed.status, 200);
  assert.deepEqual((await getDashboard(base)).body.counts,
    { pending: 0, completed: 1, failed: 0, redesigned: 0 });

  const failedRoot = await post(base, '/api/quests', { availableMinutes: 10, energy: 'medium' });
  assert.equal(failedRoot.status, 201);
  const failed = await post(base, `/api/quests/${failedRoot.body.quest.id}/fail`,
    { failureReason: 'time_shortage' });
  assert.equal(failed.status, 200);
  assert.deepEqual((await getDashboard(base)).body.nextAction,
    { kind: 'redesign', questId: failedRoot.body.quest.id, rootQuestId: failedRoot.body.quest.id });
  const redesigned = await post(base, `/api/quests/${failedRoot.body.quest.id}/redesign`, {});
  assert.equal(redesigned.status, 201);
  const confirmed = (await getDashboard(base)).body;
  assert.deepEqual(confirmed.counts, { pending: 1, completed: 1, failed: 1, redesigned: 1 });
  assert.deepEqual(confirmed.nextAction, { kind: 'resume', questId: redesigned.body.quest.id,
    rootQuestId: failedRoot.body.quest.id });
  assert.deepEqual(confirmed.histories.find((item) => item.rootQuestId === failedRoot.body.quest.id).quests,
    [failed.body.quest, redesigned.body.quest]);

  const before = await readFile(options.dataFile, 'utf8');
  const conflict = await post(base, `/api/quests/${failedRoot.body.quest.id}/complete`, {});
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.error.code, 'QUEST_ALREADY_RESOLVED');
  assert.equal(await readFile(options.dataFile, 'utf8'), before);
  assert.deepEqual((await getDashboard(base)).body, confirmed);

  const backup = `${options.dataFile}.backup`;
  await rename(options.dataFile, backup);
  await mkdir(options.dataFile);
  try {
    const persistenceFailure = await post(base, `/api/quests/${redesigned.body.quest.id}/complete`, {});
    assert.equal(persistenceFailure.status, 503);
    assert.equal(persistenceFailure.body.error.code, 'PERSISTENCE_ERROR');
    assert.deepEqual((await getDashboard(base)).body, confirmed);
  } finally {
    await rmdir(options.dataFile);
    await rename(backup, options.dataFile);
  }
  assert.equal(await readFile(options.dataFile, 'utf8'), before);
});

test('누락·중복·잘못된 루트 관계는 부분 집계로 반환하지 않는다', () => {
  for (const mutate of [
    (value) => { value.quests[1].rootQuestId = ids.C; },
    (value) => { value.quests[1].parentQuestId = ids.G; },
    (value) => { value.quests.push({ ...value.quests[1], id: ids.G }); },
    (value) => { value.quests[0].parentQuestId = ids.F; },
  ]) {
    const source = complexSnapshot();
    const before = structuredClone(source);
    mutate(source);
    assert.throws(() => projectDashboard(source));
    assert.equal(source.quests[0].id, before.quests[0].id);
  }
});
