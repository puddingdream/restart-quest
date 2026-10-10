import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createQuest, failureReasons, validateInput } from './quests.js';
import { createQuestStore, QuestMutationError } from './store.js';

const MAX_BODY_BYTES = 16 * 1024;
const uuidPattern = /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
const mutationErrors = {
  NOT_FOUND: [404, '퀘스트를 찾을 수 없습니다.'],
  QUEST_ALREADY_RESOLVED: [409, '이미 기록된 퀘스트입니다. 저장된 상태를 확인해 주세요.'],
  QUEST_NOT_FAILED: [409, '실패로 기록된 퀘스트만 다시 설계할 수 있습니다.'],
  QUEST_ALREADY_REDESIGNED: [409, '이미 더 작은 행동이 있습니다. 이력을 확인해 주세요.'],
  REDESIGN_LIMIT_REACHED: [409, '더 줄일 수 없는 1분 행동입니다. 잠시 쉬거나 새 퀘스트를 만들어 보세요.'],
};
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function json(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

function failure(response, status, code, message, fields = {}) {
  json(response, status, { error: { code, message, fields } });
}

async function readBody(request) {
  let size = 0;
  let tooLarge = false;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      tooLarge = true;
    } else {
      chunks.push(chunk);
    }
  }
  if (tooLarge) return { tooLarge: true };
  try {
    return { value: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))) };
  } catch {
    return { invalid: true };
  }
}

async function serveStatic(request, response, publicDir, pathname) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    response.writeHead(404);
    response.end();
    return;
  }
  const parts = decoded.split('/').filter(Boolean);
  if (parts.some((part) => part === '..' || part === '.' || part.startsWith('.') || part.includes('\\') || part.includes('\0'))) {
    response.writeHead(404);
    response.end();
    return;
  }
  const name = parts.length ? join(...parts) : 'index.html';
  const type = types[extname(name).toLowerCase()];
  if (!type) {
    response.writeHead(404);
    response.end();
    return;
  }
  try {
    const root = await realpath(publicDir);
    const target = await realpath(join(root, name));
    const inside = relative(root, target);
    if (inside.startsWith(`..${sep}`) || inside === '..' || isAbsolute(inside)) throw new Error('Outside public directory');
    const content = await readFile(target);
    response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    response.writeHead(404);
    response.end();
  }
}

export async function createQuestServer({
  dataFile = resolve('data/quests.json'),
  publicDir = resolve('client/dist'),
} = {}) {
  const store = await createQuestStore(dataFile);
  return createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      if (pathname === '/api/quests') {
        if (request.method === 'GET') {
          json(response, 200, { quests: store.list() });
          return;
        }
        if (request.method !== 'POST') {
          response.setHeader('Allow', 'GET, POST');
          failure(response, 405, 'METHOD_NOT_ALLOWED', '지원하지 않는 요청 방식입니다.');
          return;
        }
        if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers['content-type']?.trim() ?? '')) {
          failure(response, 415, 'UNSUPPORTED_MEDIA_TYPE', 'JSON 형식으로 보내 주세요.');
          return;
        }
        const body = await readBody(request);
        if (body.tooLarge) {
          failure(response, 413, 'PAYLOAD_TOO_LARGE', '요청 내용이 너무 큽니다.');
          return;
        }
        if (body.invalid || !body.value || typeof body.value !== 'object' || Array.isArray(body.value)) {
          failure(response, 400, 'INVALID_JSON', 'JSON 객체를 확인해 주세요.');
          return;
        }
        const fields = validateInput(body.value);
        if (Object.keys(fields).length) {
          const message = fields.availableMinutes
            ? '시간은 5분에서 120분 사이의 정수로 입력해 주세요.'
            : '입력 내용을 확인해 주세요.';
          failure(response, 400, 'INVALID_INPUT', message, fields);
          return;
        }
        const quest = createQuest(body.value);
        try {
          await store.add(quest);
        } catch {
          failure(response, 503, 'PERSISTENCE_ERROR', '저장에 실패했습니다. 잠시 후 다시 확인해 주세요.');
          return;
        }
        json(response, 201, { quest });
        return;
      }
      const detail = /^\/api\/quests\/([^/]+)\/(complete|fail|redesign|history)$/.exec(pathname);
      if (detail) {
        const [, id, action] = detail;
        let body;
        if (request.method !== (action === 'history' ? 'GET' : 'POST')) {
          response.setHeader('Allow', action === 'history' ? 'GET' : 'POST');
          failure(response, 405, 'METHOD_NOT_ALLOWED', '지원하지 않는 요청 방식입니다.');
          return;
        }
        if (action !== 'history') {
          if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers['content-type']?.trim() ?? '')) {
            failure(response, 415, 'UNSUPPORTED_MEDIA_TYPE', 'JSON 형식으로 보내 주세요.');
            return;
          }
          body = await readBody(request);
          if (body.tooLarge) {
            failure(response, 413, 'PAYLOAD_TOO_LARGE', '요청 내용이 너무 큽니다.');
            return;
          }
          if (body.invalid || !body.value || typeof body.value !== 'object' || Array.isArray(body.value)) {
            failure(response, 400, 'INVALID_JSON', 'JSON 객체를 확인해 주세요.');
            return;
          }
          const fields = Object.create(null);
          for (const key of Object.keys(body.value)) {
            if (key !== 'failureReason' || action !== 'fail') fields[key] = '알 수 없는 필드입니다.';
          }
          if (action === 'fail' && !failureReasons.has(body.value.failureReason)) {
            fields.failureReason = '지원하는 실패 이유를 선택해 주세요.';
          }
          if (Object.keys(fields).length) {
            failure(response, 400, 'INVALID_INPUT', action === 'fail' ? '실패 이유를 선택해 주세요.' : '입력 내용을 확인해 주세요.', fields);
            return;
          }
        }
        if (!uuidPattern.test(id)) {
          failure(response, 400, 'INVALID_INPUT', '퀘스트 ID를 확인해 주세요.', { id: '유효한 퀘스트 ID가 필요합니다.' });
          return;
        }
        if (action === 'history') {
          const history = store.history(id);
          if (!history) failure(response, 404, 'NOT_FOUND', mutationErrors.NOT_FOUND[1]);
          else json(response, 200, history);
          return;
        }
        try {
          const quest = action === 'redesign'
            ? await store.redesign(id)
            : await store.transition(id, action, body.value.failureReason);
          json(response, action === 'redesign' ? 201 : 200, { quest });
        } catch (error) {
          if (error instanceof QuestMutationError) {
            const [status, message] = mutationErrors[error.code];
            failure(response, status, error.code, message);
          } else {
            failure(response, 503, 'PERSISTENCE_ERROR', '저장에 실패했습니다. 잠시 후 다시 확인해 주세요.');
          }
        }
        return;
      }
      if (pathname === '/api' || pathname.startsWith('/api/')) {
        failure(response, 404, 'NOT_FOUND', '요청한 API를 찾을 수 없습니다.');
        return;
      }
      await serveStatic(request, response, publicDir, pathname);
    } catch {
      if (!response.headersSent) failure(response, 500, 'INTERNAL_ERROR', '요청을 처리하지 못했습니다.');
      else response.end();
    }
  });
}
