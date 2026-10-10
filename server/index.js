import { resolve } from 'node:path';
import { createQuestServer } from './app.js';

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error('PORT must be an integer from 0 to 65535');
}

const server = await createQuestServer({
  dataFile: resolve(process.env.QUEST_DATA_FILE ?? 'data/quests.json'),
  publicDir: resolve(process.env.QUEST_PUBLIC_DIR ?? 'client/dist'),
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Re:Start Quest listening on http://127.0.0.1:${server.address().port}`);
});
