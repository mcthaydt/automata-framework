/**
 * What a server process is given (M7 spec §4.3 `ServerLimits`, `startServer`'s config).
 *
 * Two limits are enforced from M7.3b: `maxRooms` (a room past it is refused `SERVER_BUSY`) and `commandsPerSeat`
 * (each seat's input meter). The rest are taken as config and wait for their gates, which sit in front of Colyseus
 * (M7.4a): `allowedOrigins`, `maxMessageBytes` (net's parser already drops a message past net's own cap),
 * `socketsPerIp` and `perIp`. The log events go to `log`; in production that is `createLogWriter`'s redacted lines
 * (M7.4b), and a test switch here (`seed`, `manualClock`, a fake `verifier`) is refused in production.
 */

import type { NetConfig } from '@mcthaydt/automata-net'
import type { SecurityTxt } from '../server/probes'
import type { SessionVerifier } from '../session/session-verifier'

/** A token bucket: up to `burst` at once, refilled at `perSecond`. */
export interface Bucket {
  readonly burst: number
  readonly perSecond: number
}

export interface ServerLimits {
  /** The most rooms the process holds; one more is refused `SERVER_BUSY`. */
  readonly maxRooms: number
  /** Exact client origins (M7.4a). */
  readonly allowedOrigins: readonly string[]
  /** A message past this is dropped before parsing (M7.4a; net's parser holds net's cap meanwhile). */
  readonly maxMessageBytes: number
  /** Sockets one address may hold (M7.4a). */
  readonly socketsPerIp: number
  /** Matchmaking per address (M7.4a). */
  readonly perIp: { readonly create: Bucket; readonly join: Bucket; readonly reconnect: Bucket }
  /** Each seat's command budget: a command past it is dropped, never a disconnect (spec §6). */
  readonly commandsPerSeat: Bucket
}

/**
 * One event worth a log line (spec §4.5's events and fields). No field holds an address, a name, a room code, a
 * token or a payload; `room` is the room's index in this process, never its code.
 */
export interface RoomLogEvent {
  readonly event: string
  readonly room?: string
  readonly seat?: number
  readonly code?: string
  readonly ms?: number
  readonly count?: number
}

/** Where SIGTERM comes from: the process in production, an emitter in a test. */
export interface SignalSource {
  on(event: 'SIGTERM', listener: () => void): unknown
  off(event: 'SIGTERM', listener: () => void): unknown
}

export interface ServerConfig {
  /** `0` asks the operating system for a free port, as every test does. */
  readonly port: number
  readonly limits: ServerLimits
  /** `content/net.toml`: the snapshot rate, the lead a client may take and the reconnect grace. */
  readonly net: NetConfig
  /** A test switch: every room's seed. Unset, each room draws a fresh one. M7.4b refuses it in production. */
  readonly seed?: number | undefined
  readonly log?: ((event: RoomLogEvent) => void) | undefined
  /**
   * A test switch: rooms start with no clock of their own, and only a test steps them, so no tick runs that the
   * test did not ask for. M7.4b refuses it in production with the other test switches.
   */
  readonly manualClock?: boolean | undefined
  /** SIGTERM's source [`process`]. */
  readonly signals?: SignalSource | undefined
  /** Ends the process after a drain [`process.exit`]. */
  readonly exit?: ((code: number) => void) | undefined
  /** Read for `NODE_ENV`: a clock hold is refused in production [`process.env`]. */
  readonly env?: Readonly<Record<string, string | undefined>> | undefined
  /** The longest a drain waits for rooms to finish [five minutes]. */
  readonly drainCapMs?: number | undefined
  /** Who a joining player is [`anonymousVerifier`, until R-13]. The fake is a test switch. */
  readonly verifier?: SessionVerifier | undefined
  /** `/.well-known/security.txt`'s contact and expiry; unset, the path is 404. */
  readonly securityTxt?: SecurityTxt | undefined
}
