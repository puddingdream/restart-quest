import { randomUUID } from 'node:crypto';
import { open, mkdir, readFile, rename, rm } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { REASONS, STATES, STEPS, initialLevel } from './quests.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QUEST_KEYS = [
  'id', 'rootId', 'parentId', 'createdAt', 'status', 'completedAt', 'failedAt',
  'availableMinutes', 'currentState', 'level', 'minutes', 'title', 'instruction',
  'failureReason', 'redesignReason'
];

export class StorageError extends Error {
  constructor(message = '저장소에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.', options) {
    super(message, options);
    this.name = 'StorageError';
  }
}

function validObject(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function validDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

function validQuest(quest) {
  if (!validObject(quest, QUEST_KEYS)) return false;
  if (!UUID.test(quest.id) || !UUID.test(quest.rootId) ||
      (quest.parentId !== null && !UUID.test(quest.parentId))) return false;
  if (!validDate(quest.createdAt) || !['pending', 'completed', 'failed'].includes(quest.status)) return false;
  if (!Number.isInteger(quest.availableMinutes) || quest.availableMinutes < 5 || quest.availableMinutes > 120 ||
      !STATES.includes(quest.currentState) || !Number.isInteger(quest.level) || quest.level < 0 || quest.level > 3) return false;
  const step = STEPS[quest.level];
  if (quest.minutes !== step.minutes || quest.title !== step.title || quest.instruction !== step.instruction) return false;
  if (quest.status === 'pending') {
    if (quest.completedAt !== null || quest.failedAt !== null || quest.failureReason !== null) return false;
  } else if (quest.status === 'completed') {
    if (!validDate(quest.completedAt) || quest.failedAt !== null || quest.failureReason !== null) return false;
  } else {
    if (quest.completedAt !== null || !validDate(quest.failedAt) ||
        !validObject(quest.failureReason, ['code', 'note']) ||
        !REASONS.includes(quest.failureReason.code) || typeof quest.failureReason.note !== 'string' ||
        quest.failureReason.note !== quest.failureReason.note.trim() ||
        [...quest.failureReason.note].length > 200) return false;
  }
  return true;
}

function validateDocument(document) {
  if (!validObject(document, ['schemaVersion', 'quests']) ||
      document.schemaVersion !== 1 || !Array.isArray(document.quests)) {
    throw new StorageError('저장된 데이터 형식이 올바르지 않습니다.');
  }
  const byId = new Map();
  for (const quest of document.quests) {
    if (!validQuest(quest) || byId.has(quest.id)) {
      throw new StorageError('저장된 퀘스트 이력이 올바르지 않습니다.');
    }
    byId.set(quest.id, quest);
  }
  const childCounts = new Map();
  for (const quest of document.quests) {
    if (quest.parentId === null) {
      if (quest.rootId !== quest.id || quest.redesignReason !== null ||
          quest.level !== initialLevel(quest.availableMinutes, quest.currentState)) {
        throw new StorageError('저장된 퀘스트 관계가 올바르지 않습니다.');
      }
      continue;
    }
    const parent = byId.get(quest.parentId);
    if (!parent || parent.status !== 'failed' || parent.level === 0 ||
        quest.rootId !== parent.rootId || quest.level !== parent.level - 1 ||
        quest.availableMinutes !== parent.availableMinutes || quest.currentState !== parent.currentState ||
        quest.redesignReason !== parent.failureReason.code || quest.id === parent.id) {
      throw new StorageError('저장된 퀘스트 관계가 올바르지 않습니다.');
    }
    childCounts.set(parent.id, (childCounts.get(parent.id) ?? 0) + 1);
    if (childCounts.get(parent.id) > 1) {
      throw new StorageError('저장된 퀘스트 관계가 올바르지 않습니다.');
    }
  }
}

export function createStore(filePath) {
  let pending = Promise.resolve();
  let hasPersistedFile = false;

  async function read() {
    let raw;
    try {
      raw = await readFile(filePath, 'utf8');
      hasPersistedFile = true;
    } catch (error) {
      if (error.code === 'ENOENT' && !hasPersistedFile) return { schemaVersion: 1, quests: [] };
      throw new StorageError(undefined, { cause: error });
    }
    let document;
    try {
      document = JSON.parse(raw);
    } catch (error) {
      throw new StorageError('저장된 데이터 형식이 올바르지 않습니다.', { cause: error });
    }
    validateDocument(document);
    return document;
  }

  async function write(document) {
    const directory = dirname(filePath);
    const temporaryPath = join(directory, `.${basename(filePath)}.${randomUUID()}.tmp`);
    let handle;
    try {
      await mkdir(directory, { recursive: true });
      handle = await open(temporaryPath, 'wx');
      await handle.writeFile(`${JSON.stringify(document, null, 2)}\n`, 'utf8');
      await handle.sync();
      await handle.close();
      handle = undefined;
      await rename(temporaryPath, filePath);
      hasPersistedFile = true;
    } catch (error) {
      if (handle) await handle.close().catch(() => {});
      await rm(temporaryPath, { force: true }).catch(() => {});
      throw new StorageError(undefined, { cause: error });
    }
  }

  return {
    async initialize() {
      await read();
    },
    read,
    transact(change) {
      const operation = pending.then(async () => {
        const document = await read();
        const result = change(document.quests);
        validateDocument(document);
        await write(document);
        return result;
      });
      pending = operation.catch(() => {});
      return operation;
    }
  };
}
