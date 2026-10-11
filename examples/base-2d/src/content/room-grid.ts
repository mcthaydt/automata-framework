// Reads a room's rows into the grid the sim uses. Kept apart from room.ts, which reads the compiled content,
// so the content compiler can load the rooms schema before any content is compiled.
import type { RoomGrid, TilePosition } from '../sim/tiles.ts'

const TILES = new Set(['#', '.', 'P', 'G'])

/**
 * A room's grid, without an ID: the content schema uses it, and the compiler reports what it
 * throws in the room's file.
 */
export function readRoomGrid(tileSize: number, rows: readonly string[]): RoomGrid {
  const width = rows[0]?.length ?? 0
  const starts: TilePosition[] = []
  const goals: TilePosition[] = []
  rows.forEach((row, ty) => {
    if (row.length !== width) throw new Error(`row ${ty} is ${row.length} tiles wide, expected ${width}`)
    for (let tx = 0; tx < row.length; tx++) {
      const tile = row.charAt(tx)
      if (!TILES.has(tile)) throw new Error(`unknown tile "${tile}" at column ${tx}, row ${ty}`)
      if (tile === 'P') starts.push({ tx, ty })
      if (tile === 'G') goals.push({ tx, ty })
    }
  })
  const start = exactlyOne('P', starts)
  const goal = exactlyOne('G', goals)
  // The character is a tile and a half tall, so it stands in P's tile and half of the one above.
  if (rows[start.ty - 1]?.charAt(start.tx) !== '.')
    throw new Error(`the tile above P (column ${start.tx}, row ${start.ty - 1}) must be empty`)
  return { tileSize, width, height: rows.length, rows, start, goal }
}

function exactlyOne(tile: string, found: readonly TilePosition[]): TilePosition {
  const [first] = found
  if (found.length !== 1 || first === undefined)
    throw new Error(`needs exactly one ${tile}, found ${found.length}`)
  return first
}
