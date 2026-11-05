// The room as the sim sees it: the content passed to createSim, read without copying. Shared with
// `src/shared/room.ts`, so the sim and the content agree on what is solid.
import { HITBOX_H, HITBOX_W } from './tuning.ts'

export interface TilePosition {
  readonly tx: number
  readonly ty: number
}

export interface RoomGrid {
  readonly tileSize: number
  readonly width: number
  readonly height: number
  readonly rows: readonly string[]
  readonly start: TilePosition
  readonly goal: TilePosition
}

/** Whether a tile blocks movement. Outside the room counts as solid, so nothing can leave it. */
export function isSolid(room: RoomGrid, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= room.width || ty >= room.height) return true
  return room.rows[ty]?.charAt(tx) === '#'
}

/** Whether a hitbox with its top-left corner at pixel (px, py) covers the given kind of tile anywhere. */
export function hitboxTouches(
  room: RoomGrid,
  px: number,
  py: number,
  test: (tx: number, ty: number) => boolean,
): boolean {
  const left = Math.floor(px / room.tileSize)
  const right = Math.floor((px + HITBOX_W - 1) / room.tileSize)
  const top = Math.floor(py / room.tileSize)
  const bottom = Math.floor((py + HITBOX_H - 1) / room.tileSize)
  for (let ty = top; ty <= bottom; ty++) for (let tx = left; tx <= right; tx++) if (test(tx, ty)) return true
  return false
}

/** Whether the hitbox at pixel (px, py) overlaps a solid tile. */
export function hitsSolid(room: RoomGrid, px: number, py: number): boolean {
  return hitboxTouches(room, px, py, (tx, ty) => isSolid(room, tx, ty))
}

/**
 * The room inside the sim's content. The content is frozen JSON, typed `unknown` by the sim, so this checks
 * its shape once per use rather than trusting a cast; a wrong shape is a setup bug and throws.
 */
export function roomOf(content: unknown): RoomGrid {
  const room = (content as { room?: RoomGrid } | null)?.room
  if (
    room === undefined ||
    typeof room.tileSize !== 'number' ||
    typeof room.width !== 'number' ||
    typeof room.height !== 'number' ||
    !Array.isArray(room.rows) ||
    typeof room.goal?.tx !== 'number' ||
    typeof room.start?.tx !== 'number'
  )
    throw new Error('emberwick: the sim content has no room')
  return room
}
