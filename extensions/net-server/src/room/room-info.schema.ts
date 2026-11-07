/**
 * The room's small synchronized state (M7-D4): what a client's room store mirrors as net's `RoomInfo`, without
 * `you`, which only the `seated` message gives. The sim's state never travels here: it is the sim's own snapshot,
 * on net's channel (law 3).
 *
 * The classes are built with `schema()` so field tracking works under ES2022 class fields; the room sees them through
 * the interfaces below.
 */

import { type ArraySchema, type Schema, schema, t } from '@colyseus/schema'
import type { RoomInfoView } from './room-engine'

export interface SeatInfoState extends Schema {
  seat: number
  name: string
  ready: boolean
  connected: boolean
  bot: boolean
}

export interface RoomInfoState extends Schema {
  /** The room code, which is the Colyseus room id. */
  code: string
  phase: string
  /** -1 while no seat hosts. */
  hostSeat: number
  seats: ArraySchema<SeatInfoState>
}

const SeatInfo = schema(
  { seat: t.uint8(), name: t.string(), ready: t.boolean(), connected: t.boolean(), bot: t.boolean() },
  'SeatInfo',
)
const RoomInfo = schema(
  { code: t.string(), phase: t.string(), hostSeat: t.int8(), seats: t.array(SeatInfo) },
  'RoomInfo',
)

export function createRoomInfoState(code: string): RoomInfoState {
  const state = new RoomInfo() as unknown as RoomInfoState
  state.code = code
  state.phase = 'lobby'
  state.hostSeat = -1
  return state
}

/** Copies the room into its state, assigning only what changed so a patch carries only that. */
export function projectRoomInfo(state: RoomInfoState, info: RoomInfoView): void {
  if (state.phase !== info.phase) state.phase = info.phase
  const host = info.hostSeat ?? -1
  if (state.hostSeat !== host) state.hostSeat = host
  while (state.seats.length > info.seats.length) state.seats.pop()
  for (const [index, seat] of info.seats.entries()) {
    const entry = state.seats[index]
    if (entry === undefined) {
      state.seats.push(new SeatInfo({ ...seat }) as unknown as SeatInfoState)
      continue
    }
    if (entry.seat !== seat.seat) entry.seat = seat.seat
    if (entry.name !== seat.name) entry.name = seat.name
    if (entry.ready !== seat.ready) entry.ready = seat.ready
    if (entry.connected !== seat.connected) entry.connected = seat.connected
    if (entry.bot !== seat.bot) entry.bot = seat.bot
  }
}
