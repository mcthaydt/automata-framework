// The base's one room, as content. Stand-in until the content compiler lands (M1.3, PR #8): then this becomes a
// `content/rooms/*.toml` file compiled by `automata-content`. The sim receives it as `content`, so the room is
// frozen and hashed together with the sim state either way.
//
// Tiles: `#` solid, `.` empty, `P` where the character starts (standing on the tile below), `G` the goal bubble.
// 40 × 24 tiles of 8 pixels is 320 × 192 pixels: a single screen, Bubble Bobble style. Platforms climb in steps
// of three tiles, about the height of a held jump, with two free rows under each so the character can walk under.

export interface RoomSource {
  readonly id: string
  readonly tileSize: number
  readonly rows: readonly string[]
}

export interface TilePosition {
  readonly tx: number
  readonly ty: number
}

export interface Room {
  readonly id: string
  readonly tileSize: number
  /** Width and height in tiles. */
  readonly width: number
  readonly height: number
  readonly rows: readonly string[]
  readonly start: TilePosition
  readonly goal: TilePosition
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

/** Whether a tile blocks movement. Outside the room counts as solid, so nothing can leave it. */
export function isSolid(room: Room, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= room.width || ty >= room.height) return true
  return room.rows[ty]?.charAt(tx) === '#'
}
