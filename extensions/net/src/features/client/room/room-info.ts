/**
 * The room as a client sees it.
 *
 * The server room keeps a small synchronized Colyseus state (code, phase, host seat, seats; `server`'s
 * `room-info.schema.ts`). Colyseus patches that state in place, which suits a transport and not a screen, so it is
 * projected here into a plain, frozen object holding no schema reference: an
 * anti-corruption boundary, not a second protocol. The projection is read through a schema: a state that does not
 * parse (the empty state before the first patch, above all) is no room yet. `you` never comes from this state: only
 * the room's `seated` message says which seat is yours.
 */

import { z } from 'zod'
import { LOBBY_PHASES, type LobbyPhase } from '../../../shared/wire/room'

export interface SeatInfo {
  readonly seat: number
  readonly name: string
  readonly ready: boolean
  readonly connected: boolean
  readonly bot: boolean
}

export interface RoomInfo {
  /** Six characters: the Colyseus room id. */
  readonly code: string
  readonly phase: LobbyPhase
  readonly seats: readonly SeatInfo[]
  /** Your seat, from the room's `seated` message only. */
  readonly you: number | undefined
  readonly hostSeat: number | undefined
}

const seatState = z.object({
  seat: z.number().int().nonnegative(),
  name: z.string(),
  ready: z.boolean(),
  connected: z.boolean(),
  bot: z.boolean(),
})

/** Not strict: a newer server may add a field, which this client ignores rather than losing the room over. */
const roomState = z.object({
  code: z.string().min(1),
  phase: z.enum(LOBBY_PHASES),
  hostSeat: z.number().int().min(-1),
  seats: z.array(seatState),
})

/** A Colyseus schema instance serializes through `toJSON`; a plain object is read as it is. */
function plainOf(state: unknown): unknown {
  const toJSON = (state as { toJSON?: unknown } | null | undefined)?.toJSON
  return typeof toJSON === 'function' ? (toJSON as () => unknown).call(state) : state
}

export function roomInfoOf(state: unknown, you: number | undefined): RoomInfo | undefined {
  const parsed = roomState.safeParse(plainOf(state))
  if (!parsed.success) return undefined
  const { code, phase, hostSeat, seats } = parsed.data
  return Object.freeze({
    code,
    phase,
    seats: Object.freeze(
      seats.map(({ seat, name, ready, connected, bot }) =>
        Object.freeze({ seat, name, ready, connected, bot }),
      ),
    ),
    you,
    hostSeat: hostSeat === -1 ? undefined : hostSeat,
  })
}

const sameSeat = (a: SeatInfo, b: SeatInfo): boolean =>
  a.seat === b.seat &&
  a.name === b.name &&
  a.ready === b.ready &&
  a.connected === b.connected &&
  a.bot === b.bot

/** Whether two projections say the same thing, so an unchanged patch publishes nothing. */
export function sameRoomInfo(a: RoomInfo | undefined, b: RoomInfo | undefined): boolean {
  if (a === undefined || b === undefined) return a === b
  return (
    a.code === b.code &&
    a.phase === b.phase &&
    a.you === b.you &&
    a.hostSeat === b.hostSeat &&
    a.seats.length === b.seats.length &&
    a.seats.every((seat, index) => {
      const other = b.seats[index]
      return other !== undefined && sameSeat(seat, other)
    })
  )
}
