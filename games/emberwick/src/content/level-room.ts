import type { RoomSource } from './room.ts'

// The room the sim plays, read from the level the 2D editor exported (`content/levels/room-1.toml`). Pure: the compiled
// level in, a `RoomSource` out (`parseRoom` then checks it). The editor's collision layer is an IntGrid whose value 1 is
// solid; the start and the ember are entities. Their pivots are the project's (`content/project.toml`; a test holds them):
// the player start stands on its tile's bottom edge, the ember is centred in its tile.

/** What this reads of a compiled level (readonly: the compiled content is frozen). */
export interface LevelLike {
  readonly id: string
  readonly size: { readonly w: number; readonly h: number }
  readonly layers: readonly {
    readonly def: string
    readonly kind: string
    readonly rows?: readonly string[]
    readonly items?: readonly { readonly def: string; readonly x: number; readonly y: number }[]
  }[]
}

const COLLISION = 'collision'
const SOLID = '1'

/** One row of the file's run-length text (`1 .*38 1`) as one character per cell: `#` solid, `.` empty. */
function decodeRow(row: string): string {
  return row
    .split(' ')
    .map((token) => {
      const [cell = '.', times = '1'] = token.split('*')
      return (cell === SOLID ? '#' : cell === '.' ? '.' : '?').repeat(Number(times))
    })
    .join('')
}

export function roomSourceOfLevel(level: LevelLike): RoomSource {
  const collision = level.layers.find((layer) => layer.def === COLLISION)
  if (collision?.rows === undefined)
    throw new Error(`level ${level.id}: it has no "${COLLISION}" layer of rows`)
  const rows = collision.rows.map(decodeRow)
  const width = rows[0]?.length ?? 0
  if (width === 0 || level.size.w % width !== 0)
    throw new Error(
      `level ${level.id}: ${level.size.w} px is not a whole number of tiles for ${width} columns`,
    )
  const tileSize = level.size.w / width
  const entities = level.layers.find((layer) => layer.kind === 'entities')?.items ?? []
  const place = (def: string, atEdge: boolean): { tx: number; ty: number } => {
    const found = entities.filter((item) => item.def === def)
    const [first] = found
    if (found.length !== 1 || first === undefined)
      throw new Error(`level ${level.id}: needs exactly one ${def}, found ${found.length}`)
    return { tx: Math.floor(first.x / tileSize), ty: Math.floor((first.y - (atEdge ? 1 : 0)) / tileSize) }
  }
  const start = place('player-start', true)
  const goal = place('goal', false)
  const marked = rows.map((row, ty) =>
    [...row]
      .map((tile, tx) =>
        tx === start.tx && ty === start.ty ? 'P' : tx === goal.tx && ty === goal.ty ? 'G' : tile,
      )
      .join(''),
  )
  return { id: level.id, tileSize, rows: marked }
}
