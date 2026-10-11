// The base's rooms as the game reads them. The room itself is content: `content/rooms/room-1.toml`, checked
// and compiled by `automata-content` (rooms.content.ts) into `content/generated/content.json`, which this
// file reads. The sim receives the compiled rooms as its content, so the room is frozen and hashed with the
// sim state.
//
// Tiles: `#` solid, `.` empty, `P` where the character starts (standing on the tile below), `G` the ember (the goal).

import compiled from '../../content/generated/content.json' with { type: 'json' }
import { FIRST_ROOM, type RoomGrid } from '../sim/tiles.ts'
import { readRoomGrid } from './room-grid.ts'

export { isSolid } from '../sim/tiles.ts'
export { readRoomGrid } from './room-grid.ts'

export interface RoomSource {
  readonly id: string
  readonly tileSize: number
  readonly rows: readonly string[]
}

/** A checked room: its size in tiles, and where the start and the goal are. */
export interface Room extends RoomGrid {
  readonly id: string
}

/**
 * The compiled content the base's sim is made with (`createBaseSim`'s default): the sim's partition of the
 * compiled content, `tuning` and `rooms`, the same shape M2.2's compiler emits as `simContent`. The sim hashes
 * its content, so this shape is part of the golden (`src/golden.ts`).
 */
export const BASE_SIM_CONTENT: {
  readonly tuning: Readonly<Record<string, number | boolean | string>>
  readonly rooms: Readonly<Record<string, RoomGrid>>
} = {
  tuning: compiled.tuning,
  rooms: compiled.rooms,
}

const firstRoom = BASE_SIM_CONTENT.rooms[FIRST_ROOM]
if (firstRoom === undefined) throw new Error(`base-2d: content/rooms/${FIRST_ROOM}.toml is missing`)

/** The shipped room as a source, for code that draws or edits it (the renderer, demos, tests). */
export const ROOM: RoomSource = { id: FIRST_ROOM, tileSize: firstRoom.tileSize, rows: firstRoom.rows }

/** Checks a room and finds its start and goal. Throws, naming the room, row and column, on anything malformed. */
export function parseRoom(source: RoomSource): Room {
  try {
    return { id: source.id, ...readRoomGrid(source.tileSize, source.rows) }
  } catch (error) {
    throw new Error(`room ${source.id}: ${error instanceof Error ? error.message : String(error)}`)
  }
}
