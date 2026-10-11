import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createQuestApi, mountQuestApp, parseInput } from '../quest-app.js';

const fixture = JSON.parse(await readFile(new URL('./fixtures/quest-api-v1.json', import.meta.url), 'utf8'));

class FakeNode {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.value = '';
    this.textContent = '';
    this.hidden = false;
    this.disabled = false;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.className = '';
    this.dataset = {};
    this.focused = false;
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
  getAttribute(name) { return this.attributes.get(name); }
  addEventListener(name, listener) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }
  async emit(name) {
    await Promise.all((this.listeners.get(name) ?? []).map((listener) =>
      listener({ preventDefault() {} })));
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  focus() { this.focused = true; }
}

function makeDocument() {
  const ids = [
    'quest-form', 'available-minutes', 'energy', 'create-button', 'form-error',
    'form-status', 'list-status', 'list-error', 'retry-button', 'empty-state',
    'quest-list', 'minutes-error', 'energy-error', 'result-section',
    'result-quest-title', 'result-description', 'result-minutes',
  ];
  const nodes = Object.fromEntries(ids.map((id) => [id, new FakeNode()]));
  nodes['available-minutes'].value = '20';
  nodes.energy.value = 'medium';
  nodes['result-section'].hidden = true;
  return { nodes, getElementById: (id) => nodes[id], createElement: (tag) => new FakeNode(tag) };
}

function makeDashboardDocument() {
  const document = makeDocument();
  for (const id of ['dashboard-section', 'dashboard-content', 'dashboard-status',
    'dashboard-error', 'dashboard-retry', 'dashboard-next', 'dashboard-counts',
    'dashboard-empty', 'dashboard-histories']) document.nodes[id] = new FakeNode();
  document.nodes['dashboard-content'].hidden = true;
  return document;
}

function queuedFetch(...responses) {
  const calls = [];
  const fetchRequest = async (url, options) => {
    calls.push({ url, options });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    if (!next) throw new Error('Unexpected request');
    return Response.json(next.body, { status: next.status ?? 200 });
  };
  return { fetchRequest, calls };
}

const body = (body, status = 200) => ({ body, status });
const nextTurn = () => new Promise((resolve) => setImmediate(resolve));
const card = (document, index = 0) => document.nodes['quest-list'].children[index];
function findNode(node, text) {
  if (node.tagName === 'button' && node.textContent === text) return node;
  for (const child of node.children) {
    const found = findNode(child, text);
    if (found) return found;
  }
  return undefined;
}
const completed = () => ({ ...fixture.quest, status: 'completed', completedAt: fixture.record.completedAt });
const failed = (reason) => ({ ...fixture.quest, status: 'failed', failureReason: reason,
  failedAt: fixture.record.failedAt });
const child = (reason) => ({ ...fixture.quest, id: fixture.record.childId,
  createdAt: fixture.record.childCreatedAt, title: fixture.failureReasons[reason].title,
  estimatedMinutes: fixture.failureReasons[reason].minutes,
  parentQuestId: fixture.quest.id, rootQuestId: fixture.quest.id });

function dashboardFetch({ dashboards, lists, posts = [], histories = [] }) {
  const calls = [];
  const fetchRequest = async (url, options) => {
    calls.push({ url, options });
    const responses = url === '/api/dashboard' ? dashboards
      : options?.method === 'POST' ? posts : url.endsWith('/history') ? histories : lists;
    const next = responses.shift();
    if (next instanceof Error) throw next;
    if (!next) throw new Error(`Unexpected request: ${url}`);
    return Response.json(next.body, { status: next.status ?? 200 });
  };
  return { fetchRequest, calls };
}

test('시간 경계와 상태를 숫자 계약으로 검증한다', () => {
  assert.deepEqual(parseInput('5', 'low').value, { availableMinutes: 5, energy: 'low' });
  assert.deepEqual(parseInput('120', 'high').value, { availableMinutes: 120, energy: 'high' });
  for (const value of ['', '4', '121', '5.5', 'abc']) {
    assert.ok(parseInput(value, 'medium').fields.availableMinutes, value);
  }
  assert.ok(parseInput('20', 'unknown').fields.energy);
});

test('첫 GET의 빈 목록은 안내를 표시하고 퀘스트를 만들지 않는다', async () => {
  const document = makeDocument();
  const { fetchRequest, calls } = queuedFetch(body(fixture.empty));
  mountQuestApp(document, fetchRequest);
  await nextTurn();
  assert.equal(document.nodes['empty-state'].hidden, false);
  assert.equal(document.nodes['quest-list'].children.length, 0);
  assert.equal(document.nodes['result-section'].hidden, true);
  assert.equal(calls[0].url, '/api/quests');
});

test('생성 성공은 POST 결과와 뒤따른 GET 저장 목록을 각각 표시한다', async () => {
  const document = makeDocument();
  const { fetchRequest, calls } = queuedFetch(body(fixture.empty), body({ quest: fixture.quest }, 201), body({ quests: [fixture.quest] }));
  mountQuestApp(document, fetchRequest);
  await nextTurn();
  await document.nodes['quest-form'].emit('submit');
  assert.equal(calls.length, 3);
  assert.equal(calls[1].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[1].options.body), { availableMinutes: 20, energy: 'medium' });
  assert.equal(document.nodes['result-section'].hidden, false);
  assert.equal(document.nodes['result-quest-title'].textContent, fixture.quest.title);
  assert.equal(document.nodes['quest-list'].children[0].children[0].textContent, fixture.quest.title);
  assert.match(document.nodes['result-minutes'].textContent, /20분/);
});

for (const [field, invalidValue, errorId] of [
  ['available-minutes', '4', 'minutes-error'],
  ['energy', 'unknown', 'energy-error'],
]) {
  test(`생성 성공 뒤 잘못된 ${field} 제출은 이전 성공 강조를 지우고 저장 목록은 유지한다`, async () => {
    const document = makeDocument();
    const { fetchRequest, calls } = queuedFetch(
      body(fixture.empty), body({ quest: fixture.quest }, 201), body({ quests: [fixture.quest] }),
      body({ quest: fixture.quest }, 201), body({ quests: [fixture.quest] }),
    );
    mountQuestApp(document, fetchRequest);
    await nextTurn();
    await document.nodes['quest-form'].emit('submit');
    assert.equal(document.nodes['result-section'].hidden, false);

    document.nodes[field].value = invalidValue;
    await document.nodes['quest-form'].emit('submit');
    assert.equal(calls.length, 3, '잘못된 입력은 POST를 추가하지 않는다');
    assert.equal(document.nodes['result-section'].hidden, true);
    assert.equal(document.nodes[errorId].hidden, false);
    assert.equal(document.nodes[field].getAttribute('aria-invalid'), 'true');
    assert.equal(document.nodes['quest-list'].children.length, 1, '기존 저장 기록은 유지한다');

    document.nodes[field].value = field === 'energy' ? 'medium' : '20';
    await document.nodes['quest-form'].emit('submit');
    assert.equal(calls.length, 5);
    assert.equal(document.nodes['result-section'].hidden, false, '새 성공에서만 다시 표시한다');
    assert.equal(document.nodes[errorId].hidden, true);
    assert.equal(document.nodes[field].getAttribute('aria-invalid'), undefined);
  });
}

test('대시보드 빈 상태와 복합 체인은 서버 fixture의 수치·순서·다음 행동을 그대로 표시한다', async () => {
  const document = makeDashboardDocument();
  const rest = structuredClone(fixture.dashboardComplex);
  rest.histories[0].quests[0].status = 'completed';
  rest.histories[0].quests[0].completedAt = '2026-10-09T10:03:00.000Z';
  rest.histories[3].quests[1].status = 'completed';
  rest.histories[3].quests[1].completedAt = '2026-10-09T10:04:00.000Z';
  rest.counts = { pending: 0, completed: 3, failed: 3, redesigned: 2 };
  rest.nextAction = { kind: 'rest_or_create', questId: rest.histories[1].quests[1].id,
    rootQuestId: rest.histories[1].rootQuestId };
  const { fetchRequest, calls } = dashboardFetch({
    dashboards: [body(fixture.dashboardEmpty), body(fixture.dashboardComplex), body(rest)],
    lists: [body(fixture.empty)],
  });
  const app = mountQuestApp(document, fetchRequest);
  await nextTurn();
  assert.equal(document.nodes['dashboard-content'].hidden, false);
  assert.deepEqual(document.nodes['dashboard-counts'].children.filter((_, index) => index % 2).map((node) => node.textContent), ['0', '0', '0', '0']);
  assert.equal(document.nodes['dashboard-empty'].hidden, false);
  assert.equal(document.nodes['dashboard-next'].children[2].href, '#quest-form');

  const refresh = app.loadDashboard();
  assert.equal(document.nodes['dashboard-content'].hidden, true, '새 GET 동안 이전 수치를 숨긴다');
  await refresh;
  assert.deepEqual(document.nodes['dashboard-counts'].children.filter((_, index) => index % 2).map((node) => node.textContent), ['2', '1', '3', '2']);
  const histories = document.nodes['dashboard-histories'].children;
  assert.deepEqual(histories.map((node) => node.children[1].textContent),
    ['55555555-5555-4555-8555-555555555555', '44444444-4444-4444-8444-444444444444',
      '33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111'].map((id) => `루트 ID: ${id}`));
  assert.match(histories[3].children[2].children[1].children[0].textContent, /짧게 시작하기.*현재 끝 행동/);
  assert.match(document.nodes['dashboard-next'].children[1].textContent, /짧게 시작하기.*5분/);
  assert.equal(document.nodes['dashboard-next'].children[2].href, `#quest-${fixture.dashboardComplex.nextAction.questId}`);
  await app.loadDashboard();
  assert.match(document.nodes['dashboard-next'].children[1].textContent, /1분짜리 행동/);
  assert.equal(document.nodes['dashboard-next'].children[2].href, '#quest-form');
  assert.equal(calls.filter(({ url }) => url === '/api/dashboard').length, 3);
});

test('대시보드 500·단절·형식 오류는 이전 성공을 숨기고 GET 재시도에서만 복구한다', async () => {
  const document = makeDashboardDocument();
  const { fetchRequest, calls } = dashboardFetch({
    dashboards: [body(fixture.dashboardComplex), body(fixture.dashboardError, 500),
      new Error('disconnected'), body({ ...fixture.dashboardComplex, counts: { pending: 99 } }),
      body(fixture.dashboardComplex)],
    lists: [body({ quests: fixture.dashboardComplex.histories.flatMap((history) => history.quests) })],
  });
  const app = mountQuestApp(document, fetchRequest);
  await nextTurn();
  for (let index = 0; index < 3; index++) {
    await app.loadDashboard();
    assert.equal(document.nodes['dashboard-content'].hidden, true);
    assert.equal(document.nodes['dashboard-error'].hidden, false);
    assert.equal(document.nodes['dashboard-retry'].hidden, false);
    assert.match(document.nodes['dashboard-error'].textContent, /다시 시도/);
  }
  await document.nodes['dashboard-retry'].emit('click');
  assert.equal(document.nodes['dashboard-content'].hidden, false);
  assert.equal(document.nodes['dashboard-error'].hidden, true);
  assert.equal(calls.filter(({ url }) => url === '/api/dashboard').length, 5);
  assert.equal(calls.filter(({ options }) => options?.method === 'POST').length, 0);
});

test('늦게 도착한 이전 대시보드 응답은 최신 조회 결과를 덮어쓰지 않는다', async () => {
  const document = makeDashboardDocument();
  let releaseOld;
  let reads = 0;
  const fetchRequest = (url) => {
    if (url === '/api/quests') return Promise.resolve(Response.json(fixture.empty));
    reads++;
    if (reads === 1) return new Promise((resolve) => { releaseOld = resolve; });
    return Promise.resolve(Response.json(fixture.dashboardComplex));
  };
  const app = mountQuestApp(document, fetchRequest);
  await nextTurn();
  await app.loadDashboard();
  releaseOld(Response.json(fixture.dashboardEmpty));
  await nextTurn();
  assert.equal(document.nodes['dashboard-content'].hidden, false);
  assert.equal(document.nodes['dashboard-counts'].children[1].textContent, '2');
  assert.equal(reads, 2);
});

test('생성과 완료 확정 뒤 대시보드를 각각 재조회하고 응답에서만 수치를 표시한다', async () => {
  const document = makeDashboardDocument();
  const done = completed();
  const dashboardPending = { counts: { pending: 1, completed: 0, failed: 0, redesigned: 0 },
    histories: [{ rootQuestId: fixture.quest.id, quests: [fixture.quest] }],
    nextAction: { kind: 'resume', questId: fixture.quest.id, rootQuestId: fixture.quest.id } };
  const dashboardDone = { counts: { pending: 0, completed: 1, failed: 0, redesigned: 0 },
    histories: [{ rootQuestId: done.id, quests: [done] }],
    nextAction: { kind: 'create', questId: null, rootQuestId: null } };
  const { fetchRequest, calls } = dashboardFetch({
    dashboards: [body(fixture.dashboardEmpty), body(dashboardPending), body(dashboardDone)],
    lists: [body(fixture.empty), body({ quests: [fixture.quest] }), body({ quests: [done] })],
    posts: [body({ quest: fixture.quest }, 201), body({ quest: done })],
  });
  mountQuestApp(document, fetchRequest);
  await nextTurn();
  await document.nodes['quest-form'].emit('submit');
  assert.equal(document.nodes['dashboard-counts'].children[1].textContent, '1');
  await findNode(card(document), '완료 기록').emit('click');
  assert.equal(document.nodes['dashboard-counts'].children[3].textContent, '1');
  assert.equal(document.nodes['dashboard-next'].children[2].href, '#quest-form');
  assert.equal(calls.filter(({ url }) => url === '/api/dashboard').length, 3);
  assert.equal(calls.filter(({ options }) => options?.method === 'POST').length, 2);
});

test('실패 이유와 재설계 뒤 대시보드의 다음 행동을 새 GET 응답으로 바꾼다', async () => {
  const document = makeDashboardDocument();
  const parent = failed('time_shortage');
  const alternative = child('time_shortage');
  const rootQuestId = fixture.quest.id;
  const initial = { counts: { pending: 1, completed: 0, failed: 0, redesigned: 0 },
    histories: [{ rootQuestId, quests: [fixture.quest] }],
    nextAction: { kind: 'resume', questId: rootQuestId, rootQuestId } };
  const afterFailure = { counts: { pending: 0, completed: 0, failed: 1, redesigned: 0 },
    histories: [{ rootQuestId, quests: [parent] }],
    nextAction: { kind: 'redesign', questId: rootQuestId, rootQuestId } };
  const afterRedesign = { counts: { pending: 1, completed: 0, failed: 1, redesigned: 1 },
    histories: [{ rootQuestId, quests: [parent, alternative] }],
    nextAction: { kind: 'resume', questId: alternative.id, rootQuestId } };
  const { fetchRequest, calls } = dashboardFetch({
    dashboards: [body(initial), body(afterFailure), body(afterRedesign)],
    lists: [body({ quests: [fixture.quest] }), body({ quests: [parent] }),
      body({ quests: [alternative, parent] })],
    posts: [body({ quest: parent }), body({ quest: alternative }, 201)],
    histories: [body({ rootQuestId, quests: [parent, alternative] })],
  });
  mountQuestApp(document, fetchRequest);
  await nextTurn();
  const reason = card(document).reasonSelect;
  reason.value = 'time_shortage';
  await reason.emit('change');
  await findNode(card(document), '실패 기록').emit('click');
  assert.match(document.nodes['dashboard-next'].children[0].textContent, /더 작게/);
  assert.match(document.nodes['dashboard-next'].children[1].textContent, /시간이 부족/);
  await findNode(card(document), '더 작은 행동 제안').emit('click');
  assert.equal(document.nodes['dashboard-counts'].children[7].textContent, '1');
  assert.equal(document.nodes['dashboard-next'].children[2].href, `#quest-${alternative.id}`);
  assert.equal(calls.filter(({ url }) => url === '/api/dashboard').length, 3);
});

for (const [name, failure, expectsRefresh] of [
  ['서버 503', body(fixture.persistenceError, 503), false],
  ['통신 오류', new Error('network lost'), true],
]) {
  test(`생성 성공 뒤 ${name}는 이전 성공 강조를 지운다`, async () => {
    const document = makeDocument();
    const responses = [body(fixture.empty), body({ quest: fixture.quest }, 201), body({ quests: [fixture.quest] }), failure];
    if (expectsRefresh) responses.push(body({ quests: [fixture.quest] }));
    const { fetchRequest, calls } = queuedFetch(...responses);
    mountQuestApp(document, fetchRequest);
    await nextTurn();
    await document.nodes['quest-form'].emit('submit');
    assert.equal(document.nodes['result-section'].hidden, false);

    await document.nodes['quest-form'].emit('submit');
    assert.equal(document.nodes['result-section'].hidden, true);
    assert.equal(document.nodes['form-error'].hidden, false);
    assert.equal(document.nodes['form-status'].textContent, '퀘스트를 만들지 못했습니다.');
    assert.equal(document.nodes['quest-list'].children.length, 1);
    assert.equal(calls.filter(({ options }) => options?.method === 'POST').length, 2);
    assert.equal(calls.length, expectsRefresh ? 5 : 4);
  });
}

test('잘못된 로컬 입력은 전송과 성공 표시 없이 필드 오류를 보인다', async () => {
  const document = makeDocument();
  const { fetchRequest, calls } = queuedFetch(body(fixture.empty));
  mountQuestApp(document, fetchRequest);
  await nextTurn();
  document.nodes['available-minutes'].value = '4';
  await document.nodes['quest-form'].emit('submit');
  assert.equal(calls.length, 1);
  assert.equal(document.nodes['available-minutes'].getAttribute('aria-invalid'), 'true');
  assert.equal(document.nodes['result-section'].hidden, true);
  assert.equal(document.nodes['available-minutes'].focused, true);
});

test('서버 400의 구조화된 오류를 필드에 표시하고 성공으로 표시하지 않는다', async () => {
  const document = makeDocument();
  const { fetchRequest } = queuedFetch(body(fixture.empty), body(fixture.invalidInput, 400));
  mountQuestApp(document, fetchRequest);
  await nextTurn();
  await document.nodes['quest-form'].emit('submit');
  assert.equal(document.nodes['form-error'].textContent, fixture.invalidInput.error.message);
  assert.equal(document.nodes['minutes-error'].textContent, fixture.invalidInput.error.fields.availableMinutes);
  assert.equal(document.nodes['result-section'].hidden, true);
});

test('저장 실패 503은 성공 표시를 하지 않고 다시 제출할 수 있다', async () => {
  const document = makeDocument();
  const { fetchRequest } = queuedFetch(body(fixture.empty), body(fixture.persistenceError, 503));
  mountQuestApp(document, fetchRequest);
  await nextTurn();
  await document.nodes['quest-form'].emit('submit');
  assert.equal(document.nodes['form-error'].textContent, fixture.persistenceError.error.message);
  assert.equal(document.nodes['result-section'].hidden, true);
  assert.equal(document.nodes['create-button'].disabled, false);
});

test('목록 API 오류는 재시도 버튼을 보이고 재조회로 복구한다', async () => {
  const document = makeDocument();
  const { fetchRequest, calls } = queuedFetch(body(fixture.persistenceError, 503), body({ quests: [fixture.quest] }));
  mountQuestApp(document, fetchRequest);
  await nextTurn();
  assert.equal(document.nodes['retry-button'].hidden, false);
  await document.nodes['retry-button'].emit('click');
  assert.equal(calls.length, 2);
  assert.equal(document.nodes['list-error'].hidden, true);
  assert.equal(document.nodes['quest-list'].children.length, 1);
});

test('POST 응답이 끊기면 재전송하지 않고 GET으로 저장 상태를 확인한다', async () => {
  const document = makeDocument();
  const { fetchRequest, calls } = queuedFetch(body(fixture.empty), new Error('network lost'), body({ quests: [fixture.quest] }));
  mountQuestApp(document, fetchRequest);
  await nextTurn();
  await document.nodes['quest-form'].emit('submit');
  assert.deepEqual(calls.map(({ options }) => options?.method ?? 'GET'), ['GET', 'POST', 'GET']);
  assert.equal(document.nodes['result-section'].hidden, true);
  assert.equal(document.nodes['quest-list'].children.length, 1);
});

test('API client는 같은 출처의 상대 경로와 JSON 요청을 사용한다', async () => {
  const { fetchRequest, calls } = queuedFetch(body({ quest: fixture.quest }, 201));
  const quest = await createQuestApi(fetchRequest).create({ availableMinutes: 20, energy: 'medium' });
  assert.equal(quest.id, fixture.quest.id);
  assert.equal(calls[0].url, '/api/quests');
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
});

test('완료 요청 중 중복 조작을 막고 확정 응답 뒤 재조회한 상태를 표시한다', async () => {
  const document = makeDocument();
  let finish;
  const calls = [];
  const fetchRequest = async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) return Response.json({ quests: [fixture.quest] });
    if (calls.length === 2) return new Promise((resolve) => { finish = resolve; });
    return Response.json({ quests: [completed()] });
  };
  mountQuestApp(document, fetchRequest);
  await nextTurn();
  const pendingCard = card(document);
  const completion = findNode(pendingCard, '완료 기록').emit('click');
  assert.equal(findNode(pendingCard, '완료 기록').disabled, true);
  assert.equal(findNode(pendingCard, '실패 기록').disabled, true);
  await findNode(pendingCard, '완료 기록').emit('click');
  assert.equal(calls.length, 2, '진행 중 POST를 중복 전송하지 않는다');
  finish(Response.json({ quest: completed() }));
  await completion;
  assert.equal(calls[1].url, `/api/quests/${fixture.quest.id}/complete`);
  assert.deepEqual(JSON.parse(calls[1].options.body), {});
  assert.match(card(document).children[3].textContent, /완료 기록/);
  assert.equal(findNode(card(document), '완료 기록'), undefined);
  assert.equal(findNode(card(document), '실패 기록'), undefined);
});

for (const [reason, expected] of Object.entries(fixture.failureReasons)) {
  test(`${reason} 기록과 더 작은 대안, 부모·루트 이력을 API 응답으로 표시한다`, async () => {
    const document = makeDocument();
    const failQuest = failed(reason);
    const newChild = child(reason);
    const { fetchRequest, calls } = queuedFetch(
      body({ quests: [fixture.quest] }), body({ quest: failQuest }),
      body({ quests: [failQuest] }), body({ quest: newChild }, 201),
      body({ quests: [newChild, failQuest] }),
      body({ rootQuestId: fixture.quest.id, quests: [failQuest, newChild] }),
    );
    mountQuestApp(document, fetchRequest);
    await nextTurn();
    const initial = card(document);
    assert.equal(findNode(initial, '실패 기록').disabled, true);
    initial.reasonSelect.value = reason;
    await initial.reasonSelect.emit('change');
    assert.equal(findNode(initial, '실패 기록').disabled, false);
    await findNode(initial, '실패 기록').emit('click');
    assert.deepEqual(JSON.parse(calls[1].options.body), { failureReason: reason });
    assert.match(card(document).children[3].textContent, new RegExp(expected.label));
    assert.equal(findNode(card(document), '실패 기록'), undefined);
    await findNode(card(document), '더 작은 행동 제안').emit('click');
    assert.equal(calls[3].url, `/api/quests/${fixture.quest.id}/redesign`);
    assert.deepEqual(JSON.parse(calls[3].options.body), {});
    assert.equal(card(document).quest.parentQuestId, fixture.quest.id);
    assert.equal(card(document).quest.rootQuestId, fixture.quest.id);
    assert.ok(card(document).quest.estimatedMinutes < failQuest.estimatedMinutes);
    assert.match(card(document).children[0].textContent, new RegExp(expected.title));
    const parent = card(document, 1);
    assert.equal(findNode(parent, '더 작은 행동 제안'), undefined);
    assert.equal(parent.historyBox.hidden, false);
    assert.match(parent.historyBox.children[2].children[1].children[2].textContent, /부모 ID:/);
    assert.equal(calls[5].url, `/api/quests/${fixture.quest.id}/history`);
  });
}

test('400 이유 필드 오류와 409 충돌은 해당 카드에 표시하고 성공 상태를 만들지 않는다', async () => {
  const document = makeDocument();
  const { fetchRequest, calls } = queuedFetch(
    body({ quests: [fixture.quest] }), body(fixture.invalidReason, 400),
    body(fixture.alreadyResolved, 409), body({ quests: [completed()] }),
  );
  mountQuestApp(document, fetchRequest);
  await nextTurn();
  card(document).reasonSelect.value = 'time_shortage';
  await card(document).reasonSelect.emit('change');
  await findNode(card(document), '실패 기록').emit('click');
  assert.equal(card(document).reasonError.textContent, fixture.invalidReason.error.fields.failureReason);
  assert.equal(card(document).reasonSelect.getAttribute('aria-invalid'), 'true');
  assert.equal(card(document).quest.status, 'pending');
  await findNode(card(document), '완료 기록').emit('click');
  assert.equal(calls[2].options.method, 'POST');
  assert.equal(card(document).quest.status, 'completed', '409 뒤 GET에서 확인한 상태만 표시한다');
  assert.equal(card(document).actionError.textContent, fixture.alreadyResolved.error.message);
});

test('503은 허위 성공 없이 재조회 동작을 제공하고 통신 단절은 POST를 재전송하지 않는다', async () => {
  const document = makeDocument();
  const { fetchRequest, calls } = queuedFetch(
    body({ quests: [fixture.quest] }), body(fixture.persistenceError, 503),
    new Error('network lost'), body({ quests: [completed()] }),
  );
  mountQuestApp(document, fetchRequest);
  await nextTurn();
  await findNode(card(document), '완료 기록').emit('click');
  assert.equal(card(document).quest.status, 'pending');
  assert.equal(card(document).actionError.textContent, fixture.persistenceError.error.message);
  assert.equal(card(document).refreshButton.hidden, false);
  await findNode(card(document), '완료 기록').emit('click');
  assert.deepEqual(calls.map(({ options }) => options?.method ?? 'GET'), ['GET', 'POST', 'POST', 'GET']);
  assert.equal(card(document).quest.status, 'completed', '확정 결과는 재조회 후에만 표시한다');
  assert.equal(card(document).actionError.hidden, true);
});

test('POST 단절 뒤 GET도 실패하면 목록 오류와 재시도를 표시하고 POST를 반복하지 않는다', async () => {
  const document = makeDocument();
  const { fetchRequest, calls } = queuedFetch(
    body({ quests: [fixture.quest] }), new Error('POST disconnected'),
    new Error('GET disconnected'), body({ quests: [fixture.quest] }),
  );
  mountQuestApp(document, fetchRequest);
  await nextTurn();
  await findNode(card(document), '완료 기록').emit('click');
  assert.deepEqual(calls.map(({ options }) => options?.method ?? 'GET'), ['GET', 'POST', 'GET']);
  assert.equal(document.nodes['quest-list'].children.length, 0);
  assert.equal(document.nodes['list-error'].hidden, false);
  assert.match(document.nodes['list-error'].textContent, /요청 결과를 확인하지 못했습니다/);
  assert.equal(document.nodes['retry-button'].hidden, false);
  await document.nodes['retry-button'].emit('click');
  assert.equal(card(document).quest.status, 'pending');
  assert.equal(calls.length, 4);
});

test('POST 응답 본문이 끊기면 성공으로 간주하지 않고 GET으로 확정 상태를 확인한다', async () => {
  const document = makeDocument();
  const calls = [];
  const fetchRequest = async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) return Response.json({ quests: [fixture.quest] });
    if (calls.length === 2) return { ok: true, status: 200, json: async () => { throw new TypeError('body interrupted'); } };
    return Response.json({ quests: [completed()] });
  };
  mountQuestApp(document, fetchRequest);
  await nextTurn();
  await findNode(card(document), '완료 기록').emit('click');
  assert.deepEqual(calls.map(({ options }) => options?.method ?? 'GET'), ['GET', 'POST', 'GET']);
  assert.equal(card(document).quest.status, 'completed');
  assert.equal(card(document).actionError.hidden, true);
  assert.match(card(document).actionStatus.textContent, /저장된 상태를 다시 확인/);
});

test('이력 조회 오류는 이력 성공 표시 없이 카드에서 재시도할 수 있다', async () => {
  const document = makeDocument();
  const { fetchRequest } = queuedFetch(body({ quests: [failed('time_shortage')] }),
    body(fixture.persistenceError, 503),
    body({ rootQuestId: fixture.quest.id, quests: [failed('time_shortage')] }));
  mountQuestApp(document, fetchRequest);
  await nextTurn();
  await findNode(card(document), '이력 보기').emit('click');
  assert.equal(card(document).historyBox.hidden, true);
  assert.equal(card(document).actionError.hidden, false);
  await findNode(card(document), '이력 보기').emit('click');
  assert.equal(card(document).historyBox.hidden, false);
  assert.equal(card(document).actionError.hidden, true);
});

test('1분 실패 기록은 더 작은 행동 요청을 내지 않고 다음 선택을 안내한다', async () => {
  const document = makeDocument();
  const oneMinute = { ...failed('unclear_start'), estimatedMinutes: 1 };
  const { fetchRequest, calls } = queuedFetch(body({ quests: [oneMinute] }));
  mountQuestApp(document, fetchRequest);
  await nextTurn();
  assert.equal(findNode(card(document), '더 작은 행동 제안'), undefined);
  assert.ok(card(document).children.some((node) => node.textContent.includes('잠시 쉬거나 새 퀘스트')));
  assert.equal(calls.length, 1);
});

for (const [name, refreshedQuest] of [
  ['미확정', fixture.quest],
  ['서버에서 확정', completed()],
]) {
  test(`응답이 멈춘 완료 요청은 재전송 없이 GET으로 ${name} 상태를 확인한다`, async () => {
    const document = makeDocument();
    const calls = [];
    const fetchRequest = (url, options) => {
      calls.push({ url, method: options.method ?? 'GET' });
      if (options.method === 'POST') {
        return new Promise((resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
        });
      }
      return Promise.resolve(Response.json({ quests: calls.length === 1 ? [fixture.quest] : [refreshedQuest] }));
    };
    mountQuestApp(document, fetchRequest, 100);
    await nextTurn();
    await findNode(card(document), '완료 기록').emit('click');
    assert.deepEqual(calls.map(({ method }) => method), ['GET', 'POST', 'GET']);
    assert.equal(card(document).quest.status, refreshedQuest.status);
    assert.equal(card(document).actionError.hidden, refreshedQuest.status === 'completed');
    if (refreshedQuest.status === 'pending') {
      assert.match(card(document).actionError.textContent, /서버 응답이 늦어지고/);
      assert.equal(findNode(card(document), '완료 기록').disabled, false);
    } else {
      assert.match(card(document).actionStatus.textContent, /저장된 상태를 다시 확인/);
      assert.equal(findNode(card(document), '완료 기록'), undefined);
    }
  });
}
