import { readFileSync } from 'node:fs'
import type { ServerResponse } from 'node:http'
import { extname, isAbsolute, join, normalize, relative } from 'node:path'

// File serving for the playground's test servers: a path is served only from inside its root folder.

const TYPES: Record<string, string> = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.wav': 'audio/wav',
  '.replay': 'application/octet-stream',
}

/** The file under `root` that `relativePath` names, or undefined when it climbs out of it. */
export function fileUnder(root: string, relativePath: string): string | undefined {
  const file = normalize(join(root, relativePath))
  const inside = relative(root, file)
  return inside === '' || inside.startsWith('..') || isAbsolute(inside) ? undefined : file
}

/** Sends `file` with `headers`, or a 404 when it is undefined or unreadable. */
export function sendFile(
  response: ServerResponse,
  file: string | undefined,
  headers: Record<string, string>,
): void {
  let body: Buffer
  try {
    if (file === undefined) throw new Error('outside the root')
    body = readFileSync(file)
  } catch {
    response.writeHead(404).end()
    return
  }
  response
    .writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', ...headers })
    .end(body)
}
