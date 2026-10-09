import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rename, rm, rmdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { createQuestServer } from './app.js';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'restart-quest-test-'));
  assert.ok(resolve(directory).startsWith(`${resolve(tmpdir())}${sep}`));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return {
    directory,
    dataFile: join(directory, 'data', 'quests.json'),
    publicDir: join(directory, 'public'),
  };
}

async function listen(t, options) {
  const server = await createQuestServer(options);
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  t.after(() => new Promise((resolveClose) => server.close(resolveClose)));
  return {
    server,
    base: `http://127.0.0.1:${server.address().port}`,
  };
}

async function request(base, method, body, headers = {}) {
  const response = await fetch(`${base}/api/quests`, {
    method,
    headers: body === undefined ? headers : { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  return { status: response.status, type: response.headers.get('content-type'), data: await response.json() };
}

const expectedKeys = [
  'id', 'createdAt', 'availableMinutes', 'energy', 'title', 'description',
  'estimatedMinutes', 'status', 'failureReason', 'completedAt', 'failedAt',
  'parentQuestId', 'rootQuestId',
].sort();

test('계약 fixture: 3개 상태의 선택표, 시간 상한, POST/GET 필드와 정렬', async (t) => {
  const options = await fixture(t);
  const { base } = await listen(t, options);
  const cases = [
    [5, 'low', 5, '관심 직무 한 개 적기'],
    [10, 'low', 10, '관심 회사 한 곳 찾아보기'],
    [120, 'low', 15, '공고 한 개 읽기'],
    [5, 'medium', 5, '지원 후보 한 곳 저장하기'],
    [10, 'medium', 10, '공고의 핵심 요건 표시하기'],
    [20, 'medium', 20, '경험 한 항목 초안 쓰기'],
    [5, 'high', 5, '지원 후보 한 곳 저장하기'],
    [15, 'high', 15, '경험 사례 하나 고르기'],
    [120, 'high', 25, '경험 사례 한 항목 작성하기'],
  ];
  const created = [];
  for (const [availableMinutes, energy, estimatedMinutes, title] of cases) {
    const result = await request(base, 'POST', { availableMinutes, energy });
    assert.equal(result.status, 201);
    assert.equal(result.type, 'application/json; charset=utf-8');
    assert.deepEqual(Object.keys(result.data.quest).sort(), expectedKeys);
    assert.match(result.data.quest.id, /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
    assert.equal(result.data.quest.rootQuestId, result.data.quest.id);
    assert.equal(result.data.quest.estimatedMinutes, estimatedMinutes);
    assert.ok(result.data.quest.estimatedMinutes <= availableMinutes);
    assert.equal(result.data.quest.title, title);
    assert.equal(result.data.quest.status, 'pending');
    for (const field of ['failureReason', 'completedAt', 'failedAt', 'parentQuestId']) {
      assert.equal(result.data.quest[field], null);
    }
    created.push(result.data.quest);
  }
  const listed = await request(base, 'GET');
  assert.equal(listed.status, 200);
  assert.deepEqual(new Set(listed.data.quests.map((quest) => quest.id)), new Set(created.map((quest) => quest.id)));
  assert.deepEqual(listed.data.quests, [...listed.data.quests].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)));
});

test('유효하지 않은 요청과 API 오류는 구조화되고 저장하지 않는다', async (t) => {
  const options = await fixture(t);
  const { base } = await listen(t, options);
  const invalid = [
    {}, { availableMinutes: 4, energy: 'low' }, { availableMinutes: 121, energy: 'high' },
    { availableMinutes: 5.5, energy: 'low' }, { availableMinutes: '5', energy: 'low' },
    { availableMinutes: null, energy: 'low' }, { availableMinutes: 5, energy: 'tired' },
    { availableMinutes: 5, energy: 'medium', unknown: true },
  ];
  for (const input of invalid) {
    const result = await request(base, 'POST', input);
    assert.equal(result.status, 400);
    assert.equal(result.data.error.code, 'INVALID_INPUT');
    assert.equal(typeof result.data.error.message, 'string');
    assert.ok(Object.keys(result.data.error.fields).length > 0);
    if (input.availableMinutes === 4) {
      assert.deepEqual(result.data, {
        error: {
          code: 'INVALID_INPUT',
          message: '시간은 5분에서 120분 사이의 정수로 입력해 주세요.',
          fields: { availableMinutes: '5~120 사이의 정수가 필요합니다.' },
        },
      });
    }
  }
  for (const body of ['{bad', '[]', 'null']) {
    const result = await request(base, 'POST', body);
    assert.equal(result.status, 400);
    assert.deepEqual(result.data.error.fields, {});
    assert.equal(result.data.error.code, 'INVALID_JSON');
  }
  const prototypeField = await request(base, 'POST', '{"availableMinutes":5,"energy":"low","__proto__":{}}');
  assert.equal(prototypeField.status, 400);
  assert.equal(prototypeField.data.error.code, 'INVALID_INPUT');
  assert.equal(prototypeField.data.error.fields.__proto__, '알 수 없는 필드입니다.');
  const wrongType = await request(base, 'POST', '{}', { 'Content-Type': 'text/plain' });
  assert.equal(wrongType.status, 415);
  assert.equal(wrongType.data.error.code, 'UNSUPPORTED_MEDIA_TYPE');
  const huge = await request(base, 'POST', { availableMinutes: 5, energy: 'low', padding: 'x'.repeat(17000) });
  assert.equal(huge.status, 413);
  assert.equal(huge.data.error.code, 'PAYLOAD_TOO_LARGE');
  const method = await fetch(`${base}/api/quests`, { method: 'PUT' });
  assert.equal(method.status, 405);
  assert.equal((await method.json()).error.code, 'METHOD_NOT_ALLOWED');
  const missing = await fetch(`${base}/api/missing`);
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, 'NOT_FOUND');
  assert.deepEqual((await request(base, 'GET')).data, { quests: [] });
});

test('동시 생성은 모두 저장하고 서버 재시작 뒤 같은 ID와 내용을 복원한다', async (t) => {
  const options = await fixture(t);
  const first = await listen(t, options);
  const results = await Promise.all(Array.from({ length: 20 }, () =>
    request(first.base, 'POST', { availableMinutes: 12, energy: 'medium' })));
  assert.ok(results.every((result) => result.status === 201));
  const before = (await request(first.base, 'GET')).data.quests;
  assert.equal(before.length, 20);
  assert.equal(new Set(before.map((quest) => quest.id)).size, 20);
  const file = JSON.parse(await readFile(options.dataFile, 'utf8'));
  assert.equal(file.schemaVersion, 1);
  assert.equal(file.quests.length, 20);
  await new Promise((resolveClose) => first.server.close(resolveClose));
  const second = await listen(t, options);
  assert.deepEqual((await request(second.base, 'GET')).data.quests, before);
});

test('손상되거나 지원하지 않는 저장 파일은 덮어쓰지 않고 시작에 실패한다', async (t) => {
  const options = await fixture(t);
  await mkdir(join(options.directory, 'data'));
  for (const content of [
    '{bad', '{"schemaVersion":2,"quests":[]}', '{"schemaVersion":1,"quests":{}}',
    '{"schemaVersion":1,"quests":[{"id":"6d4e86be-c832-4a80-8853-1b0d7a11a723","createdAt":"2026-10-09T00:00:00.000Z"}]}',
  ]) {
    await writeFile(options.dataFile, content);
    await assert.rejects(createQuestServer(options));
    assert.equal(await readFile(options.dataFile, 'utf8'), content);
  }
});

test('파일 교체 실패는 503이며 메모리 목록을 변경하지 않는다', async (t) => {
  const options = await fixture(t);
  const { base } = await listen(t, options);
  const saved = await request(base, 'POST', { availableMinutes: 5, energy: 'low' });
  assert.equal(saved.status, 201);
  const backup = `${options.dataFile}.backup`;
  await rename(options.dataFile, backup);
  await mkdir(options.dataFile, { recursive: true });
  const result = await request(base, 'POST', { availableMinutes: 5, energy: 'low' });
  assert.equal(result.status, 503);
  assert.deepEqual(result.data, {
    error: { code: 'PERSISTENCE_ERROR', message: '저장에 실패했습니다. 잠시 후 다시 확인해 주세요.', fields: {} },
  });
  assert.deepEqual((await request(base, 'GET')).data, { quests: [saved.data.quest] });
  await rmdir(options.dataFile);
  await rename(backup, options.dataFile);
  const recovered = await request(base, 'POST', { availableMinutes: 5, energy: 'low' });
  assert.equal(recovered.status, 201);
  assert.equal((await request(base, 'GET')).data.quests.length, 2);
});

test('화면 파일은 같은 origin에서 제공하고 숨김 파일과 API 외 경로는 노출하지 않는다', async (t) => {
  const options = await fixture(t);
  await mkdir(options.publicDir);
  await writeFile(join(options.publicDir, 'index.html'), '<main>계약 fixture</main>');
  await writeFile(join(options.publicDir, 'app.js'), 'export const fixture = true;');
  await writeFile(join(options.publicDir, '.private'), 'hidden');
  const { base } = await listen(t, options);
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(await page.text(), '<main>계약 fixture</main>');
  const script = await fetch(`${base}/app.js`);
  assert.equal(script.status, 200);
  assert.equal(await script.text(), 'export const fixture = true;');
  assert.equal((await fetch(`${base}/.private`)).status, 404);
  assert.equal((await fetch(`${base}/missing.html`)).status, 404);
  assert.equal((await fetch(`${base}/api/quests`)).status, 200);
});
