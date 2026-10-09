import { randomUUID } from 'node:crypto';
import { open, readFile, mkdir, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';

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
    (quest.failureReason === null || typeof quest.failureReason === 'string') &&
    (quest.completedAt === null || timestampPattern.test(quest.completedAt)) &&
    (quest.failedAt === null || timestampPattern.test(quest.failedAt)) &&
    (quest.parentQuestId === null || uuidPattern.test(quest.parentQuestId)) &&
    uuidPattern.test(quest.rootQuestId);
}

function validSnapshot(value) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    value.schemaVersion === 1 && Array.isArray(value.quests) &&
    value.quests.every(validQuest) &&
    new Set(value.quests.map((quest) => quest.id)).size === value.quests.length;
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
  return {
    list() {
      return [...snapshot.quests].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
    },
    add(quest) {
      const operation = writes.then(async () => {
        const next = { schemaVersion: 1, quests: [...snapshot.quests, quest] };
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
        } catch (error) {
          if (handle) await handle.close().catch(() => {});
          await unlink(temporary).catch(() => {});
          throw error;
        }
      });
      writes = operation.catch(() => {});
      return operation;
    },
  };
}
