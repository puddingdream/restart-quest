import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const publicOrigin = process.argv[2];
if (!publicOrigin) {
  throw new Error('Usage: node deploy/smoke.mjs <public-origin>');
}

const origin = new URL(publicOrigin);
if (!['http:', 'https:'].includes(origin.protocol) || origin.pathname !== '/' || origin.search || origin.hash) {
  throw new Error('public-origin must contain only scheme, host, and optional port');
}

let sessionCookie;
let csrfToken;

function mutationHeaders(extra = {}) {
  return {
    ...extra,
    'Idempotency-Key': randomUUID(),
    'X-CSRF-Token': csrfToken,
  };
}

async function request(path, options = {}, expectedStatus = 200, cookieOverride = sessionCookie) {
  const headers = new Headers(options.headers);
  headers.set('Origin', origin.origin);
  if (cookieOverride) headers.set('Cookie', cookieOverride);

  const response = await fetch(new URL(path, origin), { ...options, headers, redirect: 'manual' });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie && options.captureCookie !== false) {
    sessionCookie = setCookie.split(';', 1)[0];
  }

  assert.equal(response.status, expectedStatus, `${options.method ?? 'GET'} ${path} status`);
  if (response.status === 204) return undefined;

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('json')) return response.json();
  return response.text();
}

function json(method, body, headers = {}) {
  return {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  };
}

async function startSession() {
  const created = await request('/api/v1/session', json('POST', { timezone: 'Asia/Seoul' }), 201);
  assert.ok(sessionCookie?.startsWith('rq_session='), 'private session cookie is issued');
  assert.equal(typeof created.csrfToken, 'string');
  csrfToken = created.csrfToken;
}

const html = await request('/');
assert.match(html, /<div id="root"><\/div>/, 'frontend production entry is served');

await request('/api/v1/bootstrap', {}, 401, undefined);
await startSession();

let bootstrap = await request('/api/v1/bootstrap');
assert.equal(bootstrap.nextRequiredAction, 'CREATE_QUEST');
csrfToken = bootstrap.csrfToken;

const created = await request(
  '/api/v1/quests',
  json('POST', {
    title: '이번 주 지원 준비',
    firstAction: { title: '채용 공고 두 개 비교하기', estimatedMinutes: 10 },
  }, mutationHeaders()),
  201,
);
assert.equal(created.nextRequiredAction, 'DO_READY_ACTION');

const blocked = await request(
  `/api/v1/actions/${created.action.id}/attempts`,
  json('POST', { outcome: 'BLOCKED', blockerCode: 'TOO_BIG', note: '범위가 큼' }, mutationHeaders()),
  201,
);
assert.equal(blocked.nextRequiredAction, 'ADAPT_BLOCKED_ACTION');
assert.ok(blocked.suggestion.estimatedMinutes <= 5, 'TOO_BIG suggestion is at most five minutes');

const adaptedTitle = '채용 공고 한 줄만 확인하기';
const adapted = await request(
  `/api/v1/attempts/${blocked.attempt.id}/adaptation`,
  json('POST', { title: adaptedTitle, estimatedMinutes: blocked.suggestion.estimatedMinutes }, mutationHeaders()),
  201,
);
assert.equal(adapted.nextRequiredAction, 'DO_READY_ACTION');

bootstrap = await request('/api/v1/bootstrap');
csrfToken = bootstrap.csrfToken;
assert.equal(bootstrap.currentAction.id, adapted.action.id);
assert.equal(bootstrap.currentAction.sourceAttemptId, blocked.attempt.id);
assert.equal(bootstrap.currentAction.title, adaptedTitle);

await request(
  `/api/v1/actions/${adapted.action.id}/attempts`,
  json('POST', { outcome: 'DONE' }, mutationHeaders()),
  201,
);

bootstrap = await request('/api/v1/bootstrap');
csrfToken = bootstrap.csrfToken;
assert.equal(bootstrap.nextRequiredAction, 'CREATE_NEXT_ACTION_OR_COMPLETE');

const history = await request('/api/v1/history?size=20');
const blockedHistory = history.items.find((item) => item.attempt.id === blocked.attempt.id);
const doneHistory = history.items.find((item) => item.action.id === adapted.action.id);
assert.equal(blockedHistory.successorAction.id, adapted.action.id);
assert.equal(doneHistory.attempt.outcome, 'DONE');

await request(
  `/api/v1/quests/${created.quest.id}/complete`,
  json('POST', { version: created.quest.version }, mutationHeaders()),
);

bootstrap = await request('/api/v1/bootstrap');
csrfToken = bootstrap.csrfToken;
assert.equal(bootstrap.nextRequiredAction, 'START_NEW_QUEST');
assert.equal(bootstrap.activeQuest, null);
assert.equal(bootstrap.recentAttempts.length, 2);

const deletedCookie = sessionCookie;
await request(
  '/api/v1/workspace',
  { method: 'DELETE', headers: mutationHeaders({ 'X-Confirm-Delete': 'delete-my-data' }), captureCookie: false },
  204,
);
await request('/api/v1/bootstrap', {}, 401, deletedCookie);

sessionCookie = undefined;
csrfToken = undefined;
await startSession();
bootstrap = await request('/api/v1/bootstrap');
csrfToken = bootstrap.csrfToken;
assert.equal(bootstrap.recentAttempts.length, 0);

const notFound = await request(
  `/api/v1/quests/${created.quest.id}/actions`,
  json('POST', { title: '삭제된 목표 접근 확인', estimatedMinutes: 2 }, mutationHeaders()),
  404,
);
assert.equal(notFound.code, 'RESOURCE_NOT_FOUND');

await request(
  '/api/v1/workspace',
  { method: 'DELETE', headers: mutationHeaders({ 'X-Confirm-Delete': 'delete-my-data' }) },
  204,
);

console.log('PASS: web, session, blocked adaptation, completion, history, deletion, and isolation smoke');

