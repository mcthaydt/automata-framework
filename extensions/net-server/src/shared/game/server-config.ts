/**
 * What a server process is given.
 *
 * Every limit is enforced: `maxRooms` (a room past it is refused `SERVER_BUSY`) and `commandsPerSeat` (each seat's
 * input meter) in the room; `allowedOrigins`, `maxMessageBytes`, `socketsPerIp` and `perIp` by the gates in
 * front of Colyseus. The log events go to `log`; in production that is `createLogWriter`'s
 * redacted lines, and a test switch here (`seed`, `manualClock`, a fake `verifier`) is refused in production.
 */

import type { NetConfig } from '@automata/net'
import type { SessionVerifier } from '../session-verifier'

/** RFC 9116's two required fields: a `mailto:` or `https:` contact, and an ISO 8601 expiry. */
export interface SecurityTxt {
  readonly contact: string
  readonly expires: string
}

/** A token bucket: up to `burst` at once, refilled at `perSecond`. */
export interface Bucket {
  readonly burst: number
  readonly perSecond: number
}

export interface ServerLimits {
  /** The most rooms the process holds; one more is refused `SERVER_BUSY`. */
  readonly maxRooms: number
  /**
   * Exact client origins (`scheme://host[:port]`): the game's Ruken `gameOrigin` (see `originsFromGameOrigin`) and
   * any web or itch.io origin. Matchmaking and sockets from any other origin, or none, are refused; empty refuses
   * to start.
   */
  readonly allowedOrigins: readonly string[]
  /**
   * A room message past this is dropped before parsing, and a matchmaking body past it gets 413. From 1 to net's
   * `MAX_MESSAGE_BYTES` [16384].
   */
  readonly maxMessageBytes: number
  /** Sockets one address may hold [16]; the server's total is a socket per seat of `maxRooms` rooms plus 64. */
  readonly socketsPerIp: number
  /**
   * Matchmaking per address: opening a room (`create`), Quick match (`quickMatch`, which fills a listed room or
   * opens one), joining by code (`join`) and reconnecting (`reconnect`). Past one: `RATE_LIMITED`.
   */
  readonly perIp: {
    readonly create: Bucket
    readonly join: Bucket
    readonly quickMatch: Bucket
    readonly reconnect: Bucket
  }
  /** Each seat's command budget: a command past it is dropped, never a disconnect. */
  readonly commandsPerSeat: Bucket
}

/**
 * One event worth a log line. No field holds an address, a name, a room code, a
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
  /**
   * The address to listen on. Unset, every address (Node's default), as a deployed server wants. The test harness
   * gives `127.0.0.1` (issue #14): on macOS a wildcard listener can share its port with another process's loopback one.
   */
  readonly host?: string | undefined
  readonly limits: ServerLimits
  /** `content/net.toml`: the snapshot rate, the lead a client may take and the reconnect grace. */
  readonly net: NetConfig
  /** A test switch: every room's seed. Unset, each room draws a fresh one. A production server refuses it. */
  readonly seed?: number | undefined
  readonly log?: ((event: RoomLogEvent) => void) | undefined
  /**
   * A test switch: rooms start with no clock of their own, and only a test steps them, so no tick runs that the
   * test did not ask for. A production server refuses it with the other test switches.
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
  /** Who a joining player is [`anonymousVerifier`, until a host verifier is given]. The fake is a test switch. */
  readonly verifier?: SessionVerifier | undefined
  /** `/.well-known/security.txt`'s contact and expiry; unset, the path is 404. */
  readonly securityTxt?: SecurityTxt | undefined
}
