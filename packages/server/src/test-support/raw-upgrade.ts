/**
 * A bare WebSocket upgrade, as a browser's first request on a socket, for the gate tests: it reports the status line
 * the server answers with (`101` once upgraded) and closes the socket at once, so it never holds a place.
 */

import { request as httpRequest } from 'node:http'
import { connect } from 'node:net'

export function upgradeStatus(port: number, origin: string | null): Promise<number | 'closed'> {
  return new Promise((resolve) => {
    const request = httpRequest({
      host: '127.0.0.1',
      port,
      path: '/no-such-room',
      agent: false,
      headers: {
        connection: 'Upgrade',
        upgrade: 'websocket',
        'sec-websocket-version': '13',
        'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
        ...(origin === null ? {} : { origin }),
      },
    })
    request.on('upgrade', (response, socket) => {
      socket.destroy()
      resolve(response.statusCode ?? 0)
    })
    request.on('response', (response) => {
      response.socket.destroy()
      resolve(response.statusCode ?? 0)
    })
    request.on('error', () => resolve('closed'))
    request.end()
  })
}

/**
 * A matchmaking POST sent exactly as written: `path` is not normalised (fetch would resolve `..` and `%2e` before
 * sending), and `chunks` go out with chunked transfer encoding and no content-length.
 */
export function rawPost(
  port: number,
  path: string,
  origin: string | null,
  body: string | readonly string[],
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const chunked = typeof body !== 'string'
    const request = httpRequest({
      host: '127.0.0.1',
      port,
      path,
      method: 'POST',
      agent: false,
      headers: {
        'content-type': 'application/json',
        ...(chunked ? { 'transfer-encoding': 'chunked' } : { 'content-length': Buffer.byteLength(body) }),
        ...(origin === null ? {} : { origin }),
      },
    })
    request.on('response', (response) => {
      let text = ''
      response.setEncoding('utf8')
      response.on('data', (chunk: string) => {
        text += chunk
      })
      response.on('end', () => resolve({ status: response.statusCode ?? 0, text }))
    })
    request.on('error', reject)
    if (typeof body === 'string') request.end(body)
    else {
      for (const chunk of body) request.write(chunk)
      request.end()
    }
  })
}

/**
 * An upgrade from a client that keeps its own end open (`allowHalfOpen`) and never closes it. Once the refusal has
 * arrived, the client writes again: a server that destroyed its socket answers with a reset, which closes the
 * client; a server still holding the half-open socket swallows the write, and the client stays open.
 */
export function halfOpenRefusal(
  port: number,
  origin: string,
): Promise<{ status: number; closedByServer: boolean }> {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port, allowHalfOpen: true })
    let answer = ''
    let probes: ReturnType<typeof setInterval> | undefined
    const status = (): number => Number(/^HTTP\/1\.1 (\d{3})/.exec(answer)?.[1] ?? 0)
    // Bounded: the answer for a server that never closes it, without waiting on a timeout in the red case forever.
    const giveUp = setTimeout(() => {
      clearInterval(probes)
      socket.destroy()
      resolve({ status: status(), closedByServer: false })
    }, 3_000)
    socket.setEncoding('utf8')
    socket.on('data', (chunk: string) => {
      answer += chunk
    })
    socket.on('end', () => {
      probes = setInterval(() => socket.write('x'), 20)
    })
    socket.on('error', () => undefined)
    socket.on('close', () => {
      clearInterval(probes)
      clearTimeout(giveUp)
      resolve({ status: status(), closedByServer: true })
    })
    socket.write(
      [
        'GET /no-such-room HTTP/1.1',
        `Host: 127.0.0.1:${port}`,
        'Connection: Upgrade',
        'Upgrade: websocket',
        'Sec-WebSocket-Version: 13',
        'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
        `Origin: ${origin}`,
        '',
        '',
      ].join('\r\n'),
    )
  })
}
