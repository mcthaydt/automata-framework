import { type ContentLevel, entitiesOf, intGridRows } from '@automata/content/level-2d'

// Reads a level the 2D editor exported into what this game plays: its size, its walls and where the player starts.
// Pure, so the sim can hold the result.

/** The value the editor's collision layer paints for a wall (its "Solid"). */
export const SOLID = 1

/** A level as the game plays it, in the game's pixels. */
export interface Level {
  readonly width: number
  readonly height: number
  /** A cell's side. */
  readonly tile: number
  /** The collision layer, row by row: `SOLID` is a wall, 0 is open. */
  readonly cells: readonly (readonly number[])[]
  /** Where the player start stands: the middle of its bottom edge. */
  readonly start: { readonly x: number; readonly y: number }
}

/** The walls are the `collision` layer and the start is the one `player-start` on the `entities` layer. */
export function levelOf(level: ContentLevel): Level {
  const cells = intGridRows(level, 'collision')
  const columns = cells[0]?.length ?? 0
  if (columns === 0) throw new Error(`Level "${level.id}" has an empty collision layer.`)
  const starts = entitiesOf(level, 'entities').filter((item) => item.def === 'player-start')
  const [start] = starts
  if (starts.length !== 1 || start === undefined)
    throw new Error(`Level "${level.id}" needs one player start. It has ${starts.length}.`)
  return {
    width: level.size.w,
    height: level.size.h,
    tile: level.size.w / columns,
    cells,
    start: { x: start.x, y: start.y },
  }
}

/** The level a system finds in `ctx.content`: the app gives the sim `LEVEL` as its content (src/app/game.ts). */
export const levelIn = (content: unknown): Level => content as Level
