import type { ContentLevel, ContentObjectItem } from './content.schema.ts'
import { article, expandRow, layerOf } from './read-level.ts'

// Reading the picture layers of an exported level: tile rows, auto-layer stacks and objects. Sim-safe like
// `read-level.ts`, and the one place the tile token grammar lives (the editor's working file prints it, the game
// reads it): an index, then `h`, `v` or `hv` for the flips, then an optional `*n` repeat.

/** One drawn tile: its index in the tileset and whether it is mirrored. */
export interface TileCell {
  readonly tile: number
  readonly flipX: boolean
  readonly flipY: boolean
}

/** A tile token without its repeat (`7`, `7h`, `7hv`) as a tile, or undefined when it is not one. */
export function parseTileToken(base: string): TileCell | undefined {
  const match = /^(\d+)(hv|h|v)?$/.exec(base)
  if (match === null) return undefined
  const flips = match[2] ?? ''
  return { tile: Number(match[1]), flipX: flips.includes('h'), flipY: flips.includes('v') }
}

/** One row of tile tokens as one cell per column; `.` is an empty cell. */
function tilesOfRow(row: string, where: string): (TileCell | undefined)[] {
  return expandRow(row, where, (base, token) => {
    if (base === '.') return undefined
    const cell = parseTileToken(base)
    if (cell === undefined) throw new Error(`${where}: "${token}" is not a tile.`)
    return cell
  })
}

const gridOf = (rows: readonly string[], where: string): (readonly (TileCell | undefined)[])[] =>
  rows.map((row, y) => tilesOfRow(row, `${where}, row ${y}`))

/** The cells of a tiles layer, one array per row (undefined is empty). Throws for a missing or other layer. */
export function tileRows(level: ContentLevel, layer: string): readonly (readonly (TileCell | undefined)[])[] {
  const found = layerOf(level, layer)
  if (found.kind !== 'tiles')
    throw new Error(
      `Level ${level.id}, layer ${layer}: it is ${article(found.kind)} ${found.kind} layer, not a tiles layer.`,
    )
  return gridOf(found.rows, `Level ${level.id}, layer ${layer}`)
}

/** The grids of an auto layer, one per stack depth, depth 0 first (the order they are drawn in). */
export function autoStacks(
  level: ContentLevel,
  layer: string,
): readonly (readonly (readonly (TileCell | undefined)[])[])[] {
  const found = layerOf(level, layer)
  if (found.kind !== 'auto')
    throw new Error(
      `Level ${level.id}, layer ${layer}: it is ${article(found.kind)} ${found.kind} layer, not an auto layer.`,
    )
  return found.stack.map((entry, depth) =>
    gridOf(entry.rows, `Level ${level.id}, layer ${layer}, depth ${depth}`),
  )
}

/** The items of an objects layer, in file order. Throws for a missing or other layer. */
export function objectsOf(level: ContentLevel, layer: string): readonly ContentObjectItem[] {
  const found = layerOf(level, layer)
  if (found.kind !== 'objects')
    throw new Error(
      `Level ${level.id}, layer ${layer}: it is ${article(found.kind)} ${found.kind} layer, not an objects layer.`,
    )
  return found.items
}
