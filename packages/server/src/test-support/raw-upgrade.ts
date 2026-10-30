/**
 * A bare WebSocket upgrade, as a browser's first request on a socket, for the gate tests: it reports the status line
 * the server answers with (`101` once upgraded) and closes the socket at once, so it never holds a place.
 */

import { request as httpRequest } from 'node:http'

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
