import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDirectory = path.join(projectRoot, 'dist')

await rm(distDirectory, { recursive: true, force: true })
await mkdir(path.join(distDirectory, 'assets'), { recursive: true })

const sourceHtml = await readFile(path.join(projectRoot, 'index.html'), 'utf8')
const apiMode = process.env.VITE_API_MODE === 'http' ? 'http' : 'mock'
const productionHtml = sourceHtml
  .replace(
    '<meta name="restart-quest-api-mode" content="mock" />',
    `<meta name="restart-quest-api-mode" content="${apiMode}" />`,
  )
  .replace(
    '<script type="module" src="/src/main.tsx"></script>',
    '<link rel="stylesheet" href="/assets/index.css" />\n    <script type="module" src="/assets/index.js"></script>',
  )

await writeFile(path.join(distDirectory, 'index.html'), productionHtml)
