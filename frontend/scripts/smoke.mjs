import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDirectory = path.join(projectRoot, 'dist')

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
    const filePath = pathname.startsWith('/assets/')
      ? path.join(distDirectory, pathname.slice(1))
      : path.join(distDirectory, 'index.html')
    if (!filePath.startsWith(distDirectory)) throw new Error('Invalid asset path')

    const body = await readFile(filePath)
    response.writeHead(200, {
      'Content-Type': filePath.endsWith('.js')
        ? 'text/javascript; charset=utf-8'
        : 'text/html; charset=utf-8',
    })
    response.end(body)
  } catch {
    response.writeHead(404)
    response.end()
  }
})

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))

try {
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing server port')
  const baseUrl = `http://127.0.0.1:${address.port}`
  const appPaths = ['/', '/login', '/signup', '/onboarding', '/today', '/dashboard']
  const [appResponses, asset] = await Promise.all([
    Promise.all(appPaths.map((appPath) => fetch(`${baseUrl}${appPath}`))),
    fetch(`${baseUrl}/assets/index.js`),
  ])
  const statuses = [...appResponses.map((response) => response.status), asset.status]
  if (statuses.some((status) => status !== 200)) {
    throw new Error(`Unexpected HTTP status: ${statuses.join(', ')}`)
  }
  const assetBytes = (await asset.arrayBuffer()).byteLength
  console.log(
    `HTTP smoke passed: app routes=200 (${appPaths.join(', ')}) asset=200 (${assetBytes} bytes)`,
  )
} finally {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
}
