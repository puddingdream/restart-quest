import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'dist');
await mkdir(output, { recursive: true });
for (const name of ['index.html', 'app.js', 'quest-app.js', 'styles.css']) {
  await cp(resolve(root, name), resolve(output, name));
}
console.log('Static client copied to dist/');
