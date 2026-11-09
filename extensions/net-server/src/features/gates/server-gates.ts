/**
 * The gates in front of Colyseus, installed on the server's listener.
 *
 * Colyseus binds its own `request` and `upgrade` listeners at `listen()`. This takes them off the listener and puts
 * them behind the gates: a matchmaking request passes `createMatchmakeGate` first, and an upgrade passes
 * `createUpgradeGate`; only what both admit reaches Colyseus. Matchmaking's CORS (Colyseus's own preflight and
 * success answers) follows the origin list too, so an unlisted page cannot read an answer.
 *
 * Colyseus's CORS hook is its matchmaker's, which is one per process like the matchmaker itself; it is restored
 * when the gates are removed.
 */

import type { Server as HttpServer, IncomingMessage, RequestListener } from 'node:http'
import type { Duplex } from 'node:stream'
import { matchMaker } from '@colyseus/core'
import type { MatchmakeGate } from './matchmake-gate'
import type { OriginPolicy } from './origins'
import type { UpgradeGate } from './upgrade-gate'

type UpgradeListener = (request: IncomingMessage, socket: Duplex, head: Buffer) => void

/**
 * The gates `installGates` puts in front of Colyseus: the origin list, the matchmaking gate and
 * the upgrade gate.
 */
export interface GateOptions {
  readonly origins: OriginPolicy
  readonly matchmake: MatchmakeGate
  readonly upgrade: UpgradeGate
}

/** Puts Colyseus's listeners behind the gates; the returned function puts them back. */
export function installGates(http: HttpServer, options: GateOptions): () => void {
  const requestListeners = http.listeners('request') as RequestListener[]
  const upgradeListeners = http.listeners('upgrade') as UpgradeListener[]
  http.removeAllListeners('request')
  http.removeAllListeners('upgrade')

  const onRequest: RequestListener = (request, response) => {
    options.matchmake(request, response).then(
      (refused) => {
        if (refused) return
        for (const listener of requestListeners) listener.call(http, request, response)
      },
      // The client went away while sending its request; there is no one to answer.
      () => response.destroy(),
    )
  }
  const onUpgrade: UpgradeListener = (request, socket, head) => {
    if (!options.upgrade(request, socket)) return
    for (const listener of upgradeListeners) listener.call(http, request, socket, head)
  }
  http.on('request', onRequest)
  http.on('upgrade', onUpgrade)

  // Colyseus merges this over its defaults, whose allow-origin is "*", so an unlisted origin gets that header
  // blanked rather than left out.
  const controller = matchMaker.controller
  const previous = controller.getCorsHeaders
  controller.getCorsHeaders = (headers: Headers) => {
    const origin = headers.get('origin') ?? undefined
    const allowed = options.origins.allows(origin) ? origin : ''
    return { 'Access-Control-Allow-Origin': allowed ?? '', Vary: 'Origin' }
  }

  return () => {
    controller.getCorsHeaders = previous
    http.off('request', onRequest)
    http.off('upgrade', onUpgrade)
    for (const listener of requestListeners) http.on('request', listener)
    for (const listener of upgradeListeners) http.on('upgrade', listener)
  }
}
