// The room's solid tiles as physics walls: one rectangle per horizontal run of `#` in a row, so the room is 56
// fixed colliders instead of one per tile. A plain function of the room (no sim, no Rapier), used once at setup.
import type { RoomGrid } from '@af-examples/base-2d/sim'
import { metresX, metresY, PX_PER_M } from './bodies.plugin.ts'

/** A wall: its centre and half extents, in metres with y up (physics' units). */
export interface WallRect {
  readonly x: number
  readonly y: number
  readonly hx: number
  readonly hy: number
}

/** Every run of solid tiles in `room`, top row first and left to right within a row. */
export function roomColliders(room: RoomGrid): WallRect[] {
  const heightPx = room.height * room.tileSize
  const halfTile = room.tileSize / 2 / PX_PER_M
  const walls: WallRect[] = []
  room.rows.forEach((row, ty) => {
    for (const run of row.matchAll(/#+/g)) {
      const startPx = (run.index ?? 0) * room.tileSize
      const widthPx = run[0].length * room.tileSize
      walls.push({
        x: metresX(startPx + widthPx / 2),
        y: metresY(ty * room.tileSize + room.tileSize / 2, heightPx),
        hx: metresX(widthPx / 2),
        hy: halfTile,
      })
    }
  })
  return walls
}
