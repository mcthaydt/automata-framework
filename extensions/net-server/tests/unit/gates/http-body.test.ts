import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { readCappedBody, refuseTooLarge } from '#src/features/gates/http-body.ts'

// One capped reader for every route that reads a body. A real listener on an ephemeral port.

let close: (() => Promise<void>) | undefined
afterEach(async () => {
  await close?.()
  close = undefined
})

type Handler = (request: IncomingMessage, response: ServerResponse) => void

async function listen(handler: Handler): Promise<number> {
  const server = createServer(handler)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  close = () =>
    new Promise((resolve) => {
      server.closeAllConnections()
      server.close(() => resolve())
    })
  const address = server.address()
  return typeof address === 'object' && address !== null ? address.port : 0
}

/** Posts `body` and reports the status, the answer, and whether the server closed the connection after it. */
const post = (port: number, body: string | (() => void)) =>
  new Promise<{ status: number; text: string; closed: boolean }>((resolve, reject) => {
    const request = httpRequest({ host: '127.0.0.1', port, method: 'POST', path: '/', agent: false })
    request.on('error', reject)
    request.on('response', (response) => {
      let text = ''
      response.setEncoding('utf8')
      response.on('data', (chunk: string) => {
        text += chunk
      })
      response.on('end', () => {
        const closed = response.headers.connection === 'close'
        resolve({ status: response.statusCode ?? 0, text, closed })
      })
    })
    if (typeof body === 'string') request.end(body)
    else {
      // A body that never ends: written in chunks and never finished.
      request.write('x'.repeat(2_048))
      request.write('x'.repeat(2_048))
    }
  })

describe('the capped body reader', () => {
  it('reads a body under the cap', async () => {
    const port = await listen((request, response) => {
      void readCappedBody(request, 64).then((body) => response.end(`got ${body}`))
    })
    expect((await post(port, '{"a":1}')).text).toBe('got {"a":1}')
  })

  it('resolves undefined once a body passes the cap, without waiting for its end', async () => {
    const port = await listen((request, response) => {
      void readCappedBody(request, 1_024).then((body) => {
        if (body === undefined) refuseTooLarge(request, response)
        else response.end('read')
      })
    })
    const answer = await post(port, () => undefined)
    expect(answer.status).toBe(413)
  })

  it('answers 413 with the error shape and closes the connection', async () => {
    const port = await listen((request, response) => {
      void readCappedBody(request, 8).then(() => refuseTooLarge(request, response, { 'x-extra': 'kept' }))
    })
    const answer = await post(port, 'x'.repeat(100))
    expect(answer).toEqual({
      status: 413,
      text: JSON.stringify({ error: 'request body too large' }),
      closed: true,
    })
  })
})
