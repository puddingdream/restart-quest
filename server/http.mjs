import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildDashboard, createQuest, createRedesign, REASONS, STATES, suggestRedesign } from './quests.mjs';
import { StorageError } from './store.mjs';

const MAX_BODY_BYTES = 1024 * 1024;
const STATIC_FILES = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']]
]);

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function validation(message = '입력값을 확인해 주세요.') {
  return new ApiError(400, 'VALIDATION_ERROR', message);
}

function exactObject(value, keys, required = keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).every((key) => keys.includes(key)) &&
    required.every((key) => Object.hasOwn(value, key));
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(body));
}

async function readJson(request, allowEmpty = false) {
  const declaredLength = Number(request.headers['content-length']);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    request.resume();
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', '요청 내용이 너무 큽니다.');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new ApiError(413, 'PAYLOAD_TOO_LARGE', '요청 내용이 너무 큽니다.');
    }
    chunks.push(chunk);
  }
  if (size === 0) {
    if (allowEmpty) return {};
    throw validation('JSON 본문을 입력해 주세요.');
  }
  try {
    const json = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
    return JSON.parse(json);
  } catch {
    throw validation('올바른 JSON 본문을 입력해 주세요.');
  }
}

function validateCreate(body) {
  if (!exactObject(body, ['availableMinutes', 'currentState']) ||
      !Number.isInteger(body.availableMinutes) || body.availableMinutes < 5 || body.availableMinutes > 120 ||
      !STATES.includes(body.currentState)) {
    throw validation('시간은 5~120분의 정수, 현재 상태는 목록의 값으로 입력해 주세요.');
  }
  return body;
}

function validateFail(body) {
  if (!exactObject(body, ['reasonCode', 'reasonNote'], ['reasonCode']) ||
      !REASONS.includes(body.reasonCode) ||
      (Object.hasOwn(body, 'reasonNote') && typeof body.reasonNote !== 'string')) {
    throw validation('실패 이유를 목록에서 선택하고 메모를 확인해 주세요.');
  }
  const note = (body.reasonNote ?? '').trim();
  if ([...note].length > 200) throw validation('실패 이유 메모는 200자 이하로 입력해 주세요.');
  return { code: body.reasonCode, note };
}

function validateEmpty(body) {
  if (!exactObject(body, [])) throw validation('이 요청에는 추가 입력값을 넣을 수 없습니다.');
}

function findQuest(quests, id) {
  const quest = quests.find((entry) => entry.id === id);
  if (!quest) throw new ApiError(404, 'NOT_FOUND', '퀘스트를 찾을 수 없습니다.');
  return quest;
}

function methodAllowed(method, allowed) {
  if (method !== allowed) throw new ApiError(405, 'METHOD_NOT_ALLOWED', '허용되지 않는 요청 방식입니다.');
}

async function handleApi(request, response, pathname, store) {
  if (pathname === '/api/health') {
    methodAllowed(request.method, 'GET');
    return sendJson(response, 200, { status: 'ok' });
  }
  if (pathname === '/api/dashboard') {
    methodAllowed(request.method, 'GET');
    const document = await store.read();
    return sendJson(response, 200, buildDashboard(document.quests));
  }
  if (pathname === '/api/quests') {
    methodAllowed(request.method, 'POST');
    const input = validateCreate(await readJson(request));
    const quest = await store.transact((quests) => {
      const created = createQuest(input);
      quests.push(created);
      return created;
    });
    return sendJson(response, 201, { quest });
  }

  const match = /^\/api\/quests\/([^/]+)\/(complete|fail|redesign)$/.exec(pathname);
  if (!match) throw new ApiError(404, 'NOT_FOUND', '요청한 API를 찾을 수 없습니다.');
  methodAllowed(request.method, 'POST');
  const [, id, action] = match;
  if (action === 'complete') {
    validateEmpty(await readJson(request, true));
    const quest = await store.transact((quests) => {
      const current = findQuest(quests, id);
      if (current.status !== 'pending') {
        throw new ApiError(409, 'INVALID_STATE', '이미 종료된 퀘스트의 상태는 바꿀 수 없습니다.');
      }
      current.status = 'completed';
      current.completedAt = new Date().toISOString();
      return current;
    });
    return sendJson(response, 200, { quest });
  }
  if (action === 'fail') {
    const reason = validateFail(await readJson(request));
    const quest = await store.transact((quests) => {
      const current = findQuest(quests, id);
      if (current.status !== 'pending') {
        throw new ApiError(409, 'INVALID_STATE', '이미 종료된 퀘스트의 상태는 바꿀 수 없습니다.');
      }
      current.status = 'failed';
      current.failedAt = new Date().toISOString();
      current.failureReason = reason;
      return current;
    });
    return sendJson(response, 200, { quest, suggestion: suggestRedesign(quest) });
  }

  validateEmpty(await readJson(request, true));
  const { quest, parentQuest } = await store.transact((quests) => {
    const parentQuest = findQuest(quests, id);
    if (parentQuest.status !== 'failed') {
      throw new ApiError(409, 'INVALID_STATE', '실패를 기록한 퀘스트만 재설계할 수 있습니다.');
    }
    if (quests.some((entry) => entry.parentId === id)) {
      throw new ApiError(409, 'ALREADY_REDESIGNED', '이미 더 쉬운 퀘스트를 만들었습니다.');
    }
    if (parentQuest.level === 0) {
      throw new ApiError(409, 'MINIMUM_STEP', '이미 가장 작은 단계입니다. 새 퀘스트를 만들어 보세요.');
    }
    const quest = createRedesign(parentQuest);
    quests.push(quest);
    return { quest, parentQuest };
  });
  return sendJson(response, 201, { quest, parentQuest });
}

async function handleStatic(request, response, pathname, publicDir) {
  const file = STATIC_FILES.get(pathname);
  if (!file) throw new ApiError(404, 'NOT_FOUND', '페이지를 찾을 수 없습니다.');
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    throw new ApiError(405, 'METHOD_NOT_ALLOWED', '허용되지 않는 요청 방식입니다.');
  }
  let content;
  try {
    content = await readFile(join(publicDir, file[0]));
  } catch (error) {
    if (error.code === 'ENOENT') throw new ApiError(404, 'NOT_FOUND', '페이지를 찾을 수 없습니다.');
    throw error;
  }
  response.writeHead(200, {
    'Content-Type': file[1],
    'Content-Length': content.length,
    'Cache-Control': 'no-store'
  });
  response.end(request.method === 'HEAD' ? undefined : content);
}

export function createRequestHandler({ store, publicDir }) {
  return async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      if (pathname.startsWith('/api/')) {
        await handleApi(request, response, pathname, store);
      } else {
        await handleStatic(request, response, pathname, publicDir);
      }
    } catch (error) {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      if (error instanceof ApiError) {
        sendJson(response, error.status, { error: { code: error.code, message: error.message } });
      } else if (error instanceof StorageError) {
        sendJson(response, 500, { error: { code: 'STORAGE_ERROR', message: '저장소에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.' } });
      } else {
        sendJson(response, 500, { error: { code: 'INTERNAL_ERROR', message: '요청을 처리하지 못했습니다. 다시 시도해 주세요.' } });
      }
    }
  };
}
