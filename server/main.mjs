import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from './http.mjs';
import { createStore } from './store.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function startServer({
  port = 3000,
  host = '127.0.0.1',
  dataFile = join(process.cwd(), 'data', 'restart-quest.json'),
  publicDir = join(projectRoot, 'public')
} = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT는 0~65535 범위의 정수여야 합니다.');
  }
  const store = createStore(dataFile);
  await store.initialize();
  const server = createServer(createRequestHandler({ store, publicDir }));
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(port, host, () => {
      server.off('error', rejectListen);
      resolveListen();
    });
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const requestedPort = process.env.PORT === undefined ? 3000 : Number(process.env.PORT);
  startServer({
    port: requestedPort,
    dataFile: process.env.RESTART_QUEST_DATA_FILE || join(process.cwd(), 'data', 'restart-quest.json')
  }).then((server) => {
    process.stdout.write(`Re:Start Quest가 http://127.0.0.1:${server.address().port}에서 실행 중입니다.\n`);
  }).catch(() => {
    process.stderr.write('서버를 시작하지 못했습니다. 저장 파일과 포트 설정을 확인해 주세요.\n');
    process.exitCode = 1;
  });
}
