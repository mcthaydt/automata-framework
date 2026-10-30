/**
 * Everything a matchmaking request passes before Colyseus sees it (FloorFifty `gate/matchmake-gate.ts`; spec §5
 * "server gates", §6):
 *
 *   1. The origin list: a request from an unlisted origin, or none, is refused (spec §6, SV-d).
 *   2. A draining server opens no room and seats nobody new; a reconnection passes (spec §6 "Server draining").
 *   3. Per-address buckets for opening rooms, Quick match, joining by code and reconnecting (spec §4.3 `perIp`).
 *   4. The body cap (`maxMessageBytes`): past it, 413 and the connection closes.
 *   5. The version gate (`matchmake-version-gate.ts`).
 *
 * The body is read here, once, and left on `request.body`, which Colyseus's router reads in place of the stream.
 * Every refusal is logged by its code through `onRefused`, never with the address.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ServerLimits } from '../game/server-config'
import { clientIp } from './client-ip'
import { readCappedBody, refuseTooLarge } from './http-body'
import { type GameVersion, refuseStaleVersion } from './matchmake-version-gate'
import type { OriginPolicy } from './origins'
import { writeRefusal } from './refusal'
import { bucketOptions, TokenBuckets } from './token-buckets'

type Limit = keyof ServerLimits['perIp']

/** Which bucket each matchmaking call takes from (FloorFifty's `TAKES`; Quick match is its Find a race). */
const TAKES: Readonly<Record<string, Limit>> = {
  create: 'create',
  joinOrCreate: 'quickMatch',
  join: 'join',
  joinById: 'join',
  reconnect: 'reconnect',
}

/** The most addresses a bucket remembers (FloorFifty `RATE_BUCKET_MAX_KEYS`). */
export const RATE_BUCKET_MAX_KEYS: number = 10_000

/** How often buckets back at their burst are forgotten. */
const SWEEP_EVERY_MS = 60_000

const CALL = /^\/matchmake\/(\w+)\//

/**
 * The path as Colyseus routes it: its router builds a WHATWG `Request` from the raw URL, which resolves `.`, `..` and
 * `%2e` segments, so `/x/../matchmake/…` reaches the matchmaker. The gate must read that same path, or such a request
 * would pass every check below untouched. `normal` is false when the raw path is not already that path: nothing a
 * browser sends, so it is refused rather than interpreted.
 */
function pathOf(url: string | undefined): { path: string; normal: boolean } {
  const raw = url ?? '/'
  const rawPath = raw.split('?')[0] ?? raw
  try {
    const path = new URL(raw, 'http://localhost').pathname
    return { path, normal: path === rawPath }
  } catch {
    return { path: rawPath, normal: false }
  }
}

export interface MatchmakeGateOptions {
  readonly origins: OriginPolicy
  readonly isDraining: () => boolean
  readonly perIp: ServerLimits['perIp']
  /** The body cap: `maxMessageBytes`. */
  readonly maxBodyBytes: number
  readonly version: GameVersion
  /** The server's clock, in milliseconds (Effect's `Clock`). */
  readonly now: () => number
  readonly onRefused: (code: string) => void
}

/** Answers the request when it is refused, and says whether it did. Anything not matchmaking passes untouched. */
export type MatchmakeGate = (request: IncomingMessage, response: ServerResponse) => Promise<boolean>

export function createMatchmakeGate(options: MatchmakeGateOptions): MatchmakeGate {
  const bucket = (limit: Limit): TokenBuckets =>
    new TokenBuckets({
      ...bucketOptions(options.perIp[limit]),
      maxKeys: RATE_BUCKET_MAX_KEYS,
      now: options.now,
    })
  const buckets: Record<Limit, TokenBuckets> = {
    create: bucket('create'),
    join: bucket('join'),
    quickMatch: bucket('quickMatch'),
    reconnect: bucket('reconnect'),
  }
  // Swept on the request path rather than on a timer: no timer to stop, and the clock is the server's.
  let sweptAt = options.now()
  const sweep = (): void => {
    if (options.now() - sweptAt < SWEEP_EVERY_MS) return
    sweptAt = options.now()
    for (const each of Object.values(buckets)) each.sweep()
  }

  return async (request, response) => {
    const refuse = (status: number, code: Parameters<typeof writeRefusal>[3], logged: string): true => {
      options.onRefused(logged)
      return writeRefusal(request, response, status, code, options.origins)
    }
    const { path, normal } = pathOf(request.url)
    if (request.method !== 'POST' || !path.startsWith('/matchmake/')) {
      // Not matchmaking as Colyseus reads it; a path that is not already normal is still refused (below).
      return normal ? false : refuse(400, 'REFUSED', 'path')
    }
    if (!options.origins.allows(request.headers.origin)) return refuse(403, 'REFUSED', 'origin')
    if (!normal) return refuse(400, 'REFUSED', 'path')

    const call = CALL.exec(path)?.[1]
    const limit = call === undefined ? undefined : TAKES[call]
    if (limit !== undefined) {
      if (options.isDraining() && limit !== 'reconnect') return refuse(503, 'SERVER_UPDATING', 'draining')
      sweep()
      if (!buckets[limit].take(clientIp(request))) return refuse(429, 'RATE_LIMITED', limit)
    }

    const body = await readCappedBody(request, options.maxBodyBytes)
    if (body === undefined) {
      options.onRefused('size')
      refuseTooLarge(request, response, options.origins.corsHeaders(request.headers.origin))
      return true
    }
    ;(request as IncomingMessage & { body?: string }).body = body
    if (refuseStaleVersion(request, response, path, body, options.version, options.origins)) {
      options.onRefused('version')
      return true
    }
    return false
  }
}
