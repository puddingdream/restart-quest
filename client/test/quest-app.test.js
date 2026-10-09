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
