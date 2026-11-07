/**
 * The server's own HTTP routes.
 *
 * - `GET /health` is liveness: 200 while the process runs, draining included, because a draining process still has
 *   games in it.
 * - `GET /ready` is readiness: 200 only while the server accepts new rooms; 503 before the game's content has loaded,
 *   at the room cap and while draining. A deploy waits on it before pointing new players at a build, and the uptime monitor reads it.
 * - `GET /.well-known/security.txt` (RFC 9116) when the server is given a contact, since a Ruken game origin serves
 *   only builds; the contact and the expiry are the game's, never AF's.
 *
 * Neither probe carries player data, and none is cached or sniffed. `/health` carries no build facts: the version check is the matchmaking gate's, so the probe says only that it is up.
 */

import type { Server as HttpServer, IncomingMessage, RequestListener, ServerResponse } from 'node:http'
import type { SecurityTxt } from '../../shared/game/server-config'

/**
 * `starting` until the content has loaded, `ready` while rooms may open, `full` at the room cap (every new room is
 * refused `SERVER_BUSY`), `draining` once SIGTERM came.
 */
export type Readiness = 'starting' | 'ready' | 'full' | 'draining'

export interface ProbeState {
  readonly readiness: () => Readiness
  readonly securityTxt?: SecurityTxt | undefined
}

/** The probes' answers are never cached and never sniffed. */
export const PROBE_HEADERS: Readonly<Record<string, string>> = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
}

export function securityTxtBody(security: SecurityTxt): string {
  return [`Contact: ${security.contact}`, `Expires: ${security.expires}`, 'Preferred-Languages: en', ''].join(
    '\n',
  )
}

const json = (response: ServerResponse, status: number, body: unknown): void => {
  response.writeHead(status, { 'content-type': 'application/json', ...PROBE_HEADERS })
  response.end(JSON.stringify(body))
}

/** Answers one of the server's own routes and returns true, or returns false for every other path. */
export function answerProbe(request: IncomingMessage, response: ServerResponse, state: ProbeState): boolean {
  const path = (request.url ?? '').split('?')[0]
  if (path === '/health') {
    json(response, 200, { ok: true })
    return true
  }
  if (path === '/ready') {
    const ready = state.readiness() === 'ready'
    json(response, ready ? 200 : 503, { ready })
    return true
  }
  if (path === '/.well-known/security.txt') {
    if (state.securityTxt === undefined) {
      response.writeHead(404, PROBE_HEADERS)
      response.end()
      return true
    }
    response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', ...PROBE_HEADERS })
    response.end(securityTxtBody(state.securityTxt))
    return true
  }
  return false
}

/**
 * Puts the probes in front of the listener's own request handlers. Colyseus binds a router at `listen()` that answers
 * every path (a 404 for those it does not know), so this runs after `listen`, takes its handlers and calls them only
 * for what the probes leave.
 */
export function installProbes(http: HttpServer, state: ProbeState): void {
  const others = http.listeners('request') as RequestListener[]
  http.removeAllListeners('request')
  http.on('request', (request: IncomingMessage, response: ServerResponse) => {
    if (answerProbe(request, response, state)) return
    for (const listener of others) listener.call(http, request, response)
  })
}
