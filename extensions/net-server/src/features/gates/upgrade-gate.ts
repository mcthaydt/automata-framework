/**
 * Every socket upgrade passes the origin list and the socket counts before the transport sees it. A refusal is a bare HTTP status on the raw socket: no WebSocket is ever opened for it.
 *
 * The count is released when the socket closes, which is why this wraps the `upgrade` listener rather than the
 * transport's `beforeUpgrade`: only the socket itself says when it has gone.
 */

import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import { clientIp } from './client-ip'
import type { OriginPolicy } from './origins'
import type { SocketGate } from './socket-gate'

/**
 * What the upgrade gate checks a socket against: the origin list and the socket counts, and where
 * refusals are reported.
 */
export interface UpgradeGateOptions {
  readonly origins: OriginPolicy
  readonly sockets: SocketGate
  /** Hears each refusal by its code (`origin`, `sockets`), never by address. */
  readonly onRefused: (code: string) => void
}

/** Admits an upgrade, or answers it and says it did not. An admitted socket is counted until it closes. */
export type UpgradeGate = (request: IncomingMessage, socket: Duplex) => boolean

/**
 * Writes the status and then destroys the socket. `end` alone leaves it half open (Node's server allows that, and an
 * upgrade has no timeout), so a client that never closed its end would hold a descriptor the count never sees.
 */
const refuse = (socket: Duplex, status: string): false => {
  socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`, () => socket.destroy())
  return false
}

/**
 * Builds the gate every WebSocket upgrade passes: the origin must be listed and the address must
 * have a socket to spare. A refusal is a bare HTTP status on the socket.
 */
export function createUpgradeGate(options: UpgradeGateOptions): UpgradeGate {
  return (request, socket) => {
    if (!options.origins.allows(request.headers.origin)) {
      options.onRefused('origin')
      return refuse(socket, '403 Forbidden')
    }
    const ip = clientIp(request)
    if (!options.sockets.admit(ip)) {
      options.onRefused('sockets')
      return refuse(socket, '429 Too Many Requests')
    }
    socket.once('close', () => options.sockets.release(ip))
    return true
  }
}
