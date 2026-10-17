import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { requestHttp } from './test-http.js';

test('Fetch 금지 포트로 배정된 테스트 서버에도 요청한다', async (t) => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end('{"ok":true}');
  });
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(6667, '127.0.0.1', () => {
        server.off('error', reject);
        resolve();
      });
    });
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      t.skip('포트 6667이 이미 사용 중입니다.');
      return;
    }
    throw error;
  }
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const result = await requestHttp('http://127.0.0.1:6667/');
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('content-type'), 'application/json');
  assert.deepEqual(await result.json(), { ok: true });
  await assert.rejects(fetch('http://127.0.0.1:6667/'),
    (error) => error.cause?.message === 'bad port');
});
