import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDirectory = path.join(projectRoot, 'dist')

function readAssetPaths(indexHtml) {
  return [
    ...new Set(
      [...indexHtml.matchAll(/\b(?:src|href)="(\/assets\/[^"?#]+)[^"\s]*"/g)].map(
        ([, assetPath]) => assetPath,
      ),
    ),
  ]
}

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
  const indexHtml = await readFile(path.join(distDirectory, 'index.html'), 'utf8')
  const assetPaths = readAssetPaths(indexHtml)
  if (assetPaths.length === 0) {
    throw new Error('Built index.html does not reference any /assets/ files')
  }

  const [appResponses, assetResponses] = await Promise.all([
    Promise.all(appPaths.map((appPath) => fetch(`${baseUrl}${appPath}`))),
    Promise.all(assetPaths.map((assetPath) => fetch(`${baseUrl}${assetPath}`))),
  ])
  const statuses = [
    ...appResponses.map((response) => response.status),
    ...assetResponses.map((response) => response.status),
  ]
  if (statuses.some((status) => status !== 200)) {
    throw new Error(`Unexpected HTTP status: ${statuses.join(', ')}`)
  }
  const assetBytes = (
    await Promise.all(
      assetResponses.map(async (response) => (await response.arrayBuffer()).byteLength),
    )
  ).reduce((total, bytes) => total + bytes, 0)
  console.log(
    `HTTP smoke passed: app routes=200 (${appPaths.join(', ')}) assets=200 (${assetPaths.length} files, ${assetBytes} bytes)`,
  )
} finally {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
}
