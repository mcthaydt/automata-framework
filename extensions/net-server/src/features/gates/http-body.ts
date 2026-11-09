/**
 * Reading a request body under a cap, and refusing one past it. One reader, so routes cannot drift.
 *
 * Past the cap the reader stops reading and resolves `undefined` at once; `refuseTooLarge` answers 413 and closes
 * the connection once the answer is out, so a body that never ends cannot hold the server reading it.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * Reads a request body up to a size cap. Past the cap it stops reading and gives back undefined.
 */
export function readCappedBody(request: IncomingMessage, limit: number): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    const onData = (chunk: Buffer): void => {
      size += chunk.length
      if (size > limit) {
        request.off('data', onData)
        request.pause()
        chunks.length = 0
        resolve(undefined)
        return
      }
      chunks.push(chunk)
    }
    request.on('data', onData)
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

/**
 * Answers 413 and closes the connection once the answer is out, so a body that never ends cannot
 * hold the server.
 */
export function refuseTooLarge(
  request: IncomingMessage,
  response: ServerResponse,
  headers: Record<string, string> = {},
): void {
  response.writeHead(413, { 'content-type': 'application/json', ...headers, connection: 'close' })
  response.end(JSON.stringify({ error: 'request body too large' }))
  response.once('finish', () => request.socket.destroy())
}
