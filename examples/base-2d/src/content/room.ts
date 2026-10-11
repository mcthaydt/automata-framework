// The base's one room, as content. Stand-in until the content compiler lands (M1.3, PR #8): then this becomes a
// `content/rooms/*.toml` file compiled by `automata-content`. The sim receives it as `content`, so the room is
// frozen and hashed together with the sim state either way.
//
// Tiles: `#` solid, `.` empty, `P` where the character starts (standing on the tile below), `G` the ember (the goal).
// 40 × 24 tiles of 8 pixels is 320 × 192 pixels: a single screen, Bubble Bobble style. Platforms climb in steps
// of three tiles, about the height of a held jump, with two free rows under each so the character can walk under.

import type { RoomGrid, TilePosition } from '../sim/tiles.ts'

export { isSolid } from '../sim/tiles.ts'

export interface RoomSource {
  readonly id: string
  readonly tileSize: number
  readonly rows: readonly string[]
}

/** A checked room: its size in tiles, and where the start and the goal are. */
export interface Room extends RoomGrid {
  readonly id: string
}

export const ROOM: RoomSource = {
  id: 'room-1',
  tileSize: 8,
  rows: [
    '########################################',
    '#......................................#',
    '#......................................#',
    '#..............G.......................#',
    '#......................................#',
    '#...........#######....................#',
    '#......................................#',
    '#......................................#',
    '#....................########..........#',
    '#...######.............................#',
    '#......................................#',
    '#...............................######.#',
    '#......................................#',
    '#......................................#',
    '#..######..............########........#',
    '#......................................#',
    '#......................................#',
    '#............########..................#',
    '#......................................#',
    '#......................................#',
    '#..########............................#',
    '#.............................##.......#',
    '#.....P.......................##.......#',
    '########################################',
  ],
}

const TILES = new Set(['#', '.', 'P', 'G'])

/** Checks a room and finds its start and goal. Throws, naming the row and column, on anything malformed. */
export function parseRoom(source: RoomSource): Room {
  const width = source.rows[0]?.length ?? 0
  const starts: TilePosition[] = []
  const goals: TilePosition[] = []
  source.rows.forEach((row, ty) => {
    if (row.length !== width)
      throw new Error(`room ${source.id}: row ${ty} is ${row.length} tiles wide, expected ${width}`)
    for (let tx = 0; tx < row.length; tx++) {
      const tile = row.charAt(tx)
      if (!TILES.has(tile))
        throw new Error(`room ${source.id}: unknown tile "${tile}" at column ${tx}, row ${ty}`)
      if (tile === 'P') starts.push({ tx, ty })
      if (tile === 'G') goals.push({ tx, ty })
    }
  })
  const start = exactlyOne(source.id, 'P', starts)
  const goal = exactlyOne(source.id, 'G', goals)
  // The character is a tile and a half tall, so it stands in P's tile and half of the one above.
  if (source.rows[start.ty - 1]?.charAt(start.tx) !== '.')
    throw new Error(
      `room ${source.id}: the tile above P (column ${start.tx}, row ${start.ty - 1}) must be empty`,
    )
  return {
    id: source.id,
    tileSize: source.tileSize,
    width,
    height: source.rows.length,
    rows: source.rows,
    start,
    goal,
  }
}

function exactlyOne(roomId: string, tile: string, found: readonly TilePosition[]): TilePosition {
  const [first] = found
  if (found.length !== 1 || first === undefined)
    throw new Error(`room ${roomId}: needs exactly one ${tile}, found ${found.length}`)
  return first
}
