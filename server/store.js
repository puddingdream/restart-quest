import { randomUUID } from 'node:crypto';
import { open, readFile, mkdir, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createRedesign, failureReasons } from './quests.js';

const uuidPattern = /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
const timestampPattern = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;

function validQuest(quest) {
  return quest && typeof quest === 'object' && !Array.isArray(quest) &&
    uuidPattern.test(quest.id) && timestampPattern.test(quest.createdAt) &&
    Number.isInteger(quest.availableMinutes) && quest.availableMinutes >= 5 && quest.availableMinutes <= 120 &&
    ['low', 'medium', 'high'].includes(quest.energy) &&
    typeof quest.title === 'string' && quest.title.length > 0 &&
    typeof quest.description === 'string' && quest.description.length > 0 &&
    Number.isInteger(quest.estimatedMinutes) && quest.estimatedMinutes > 0 &&
    quest.estimatedMinutes <= quest.availableMinutes &&
    ['pending', 'completed', 'failed'].includes(quest.status) &&
    (quest.failureReason === null || failureReasons.has(quest.failureReason)) &&
    (quest.completedAt === null || timestampPattern.test(quest.completedAt)) &&
    (quest.failedAt === null || timestampPattern.test(quest.failedAt)) &&
    (quest.parentQuestId === null || uuidPattern.test(quest.parentQuestId)) &&
    uuidPattern.test(quest.rootQuestId) &&
    (quest.status === 'pending'
      ? quest.failureReason === null && quest.completedAt === null && quest.failedAt === null
      : quest.status === 'completed'
        ? quest.failureReason === null && quest.completedAt !== null && quest.failedAt === null
        : quest.failureReason !== null && quest.completedAt === null && quest.failedAt !== null);
}

function validSnapshot(value) {
  if (!(value && typeof value === 'object' && !Array.isArray(value) &&
    value.schemaVersion === 1 && Array.isArray(value.quests) &&
    value.quests.every(validQuest) &&
    new Set(value.quests.map((quest) => quest.id)).size === value.quests.length)) return false;
  const byId = new Map(value.quests.map((quest) => [quest.id, quest]));
  const children = new Set();
  return value.quests.every((quest) => {
    if (quest.parentQuestId === null) return quest.rootQuestId === quest.id;
    const parent = byId.get(quest.parentQuestId);
    const root = byId.get(quest.rootQuestId);
    if (!parent || !root || root.parentQuestId !== null || children.has(parent.id)) return false;
    children.add(parent.id);
    return parent.status === 'failed' && parent.rootQuestId === quest.rootQuestId &&
      parent.availableMinutes === quest.availableMinutes && parent.energy === quest.energy &&
      quest.estimatedMinutes < parent.estimatedMinutes;
  });
}

export class QuestMutationError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

export async function createQuestStore(filePath) {
  let snapshot = { schemaVersion: 1, quests: [] };
  try {
    const loaded = JSON.parse(await readFile(filePath, 'utf8'));
    if (!validSnapshot(loaded)) throw new Error('Invalid or unsupported quest snapshot');
    snapshot = loaded;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  let writes = Promise.resolve();
  function mutate(change) {
    const operation = writes.then(async () => {
      const quests = snapshot.quests.map((quest) => ({ ...quest }));
      const result = change(quests);
      const next = { schemaVersion: 1, quests };
      const directory = dirname(filePath);
      const temporary = `${filePath}.${randomUUID()}.tmp`;
      let handle;
      try {
        await mkdir(directory, { recursive: true });
        handle = await open(temporary, 'wx', 0o600);
        await handle.writeFile(JSON.stringify(next), 'utf8');
        await handle.sync();
        await handle.close();
        handle = undefined;
        await rename(temporary, filePath);
        snapshot = next;
        return result;
      } catch (error) {
        if (handle) await handle.close().catch(() => {});
        await unlink(temporary).catch(() => {});
        throw error;
      }
    });
    writes = operation.catch(() => {});
    return operation;
  }
  return {
    list() {
      return [...snapshot.quests].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
    },
    history(id) {
      const quest = snapshot.quests.find((item) => item.id === id);
      if (!quest) return null;
      const chain = [];
      let current = snapshot.quests.find((item) => item.id === quest.rootQuestId);
      while (current) {
        chain.push(current);
        current = snapshot.quests.find((item) => item.parentQuestId === current.id);
      }
      return { rootQuestId: quest.rootQuestId, quests: chain };
    },
    add(quest) {
      return mutate((quests) => { quests.push(quest); return quest; });
    },
    transition(id, action, failureReason) {
      return mutate((quests) => {
        const quest = quests.find((item) => item.id === id);
        if (!quest) throw new QuestMutationError('NOT_FOUND');
        if (quest.status !== 'pending') throw new QuestMutationError('QUEST_ALREADY_RESOLVED');
        if (action === 'complete') {
          quest.status = 'completed';
          quest.completedAt = new Date().toISOString();
        } else {
          quest.status = 'failed';
          quest.failureReason = failureReason;
          quest.failedAt = new Date().toISOString();
        }
        return quest;
      });
    },
    redesign(id) {
      return mutate((quests) => {
        const parent = quests.find((item) => item.id === id);
        if (!parent) throw new QuestMutationError('NOT_FOUND');
        if (parent.status !== 'failed') throw new QuestMutationError('QUEST_NOT_FAILED');
        if (quests.some((item) => item.parentQuestId === id)) {
          throw new QuestMutationError('QUEST_ALREADY_REDESIGNED');
        }
        if (parent.estimatedMinutes === 1) throw new QuestMutationError('REDESIGN_LIMIT_REACHED');
        const root = quests.find((item) => item.id === parent.rootQuestId);
        const child = createRedesign(parent, root);
        quests.push(child);
        return child;
      });
    },
  };
}
