import type { TemplateFile } from './template-file.ts'

// The new game's level feature: the level the 2D editor exported, read into walls and a start; the wall test the sim
// runs; and the walls drawn. The level itself is in the game's `content/` (template-content.ts).

/** The level feature: the editor's level read into walls and a start, the wall test the sim runs, and the walls drawn. */
export const LEVEL_FILES: readonly TemplateFile[] = [
  {
    path: 'src/features/level/read-level.ts',
    content:
      () => `import { type ContentLevel, entitiesOf, intGridRows } from '@mcthaydt/automata-content/level-2d'

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
  /** The collision layer, row by row: \`SOLID\` is a wall, 0 is open. */
  readonly cells: readonly (readonly number[])[]
  /** Where the player start stands: the middle of its bottom edge. */
  readonly start: { readonly x: number; readonly y: number }
}

/** The walls are the \`collision\` layer and the start is the one \`player-start\` on the \`entities\` layer. */
export function levelOf(level: ContentLevel): Level {
  const cells = intGridRows(level, 'collision')
  const columns = cells[0]?.length ?? 0
  if (columns === 0) throw new Error(\`Level "\${level.id}" has an empty collision layer.\`)
  const starts = entitiesOf(level, 'entities').filter((item) => item.def === 'player-start')
  const [start] = starts
  if (starts.length !== 1 || start === undefined)
    throw new Error(\`Level "\${level.id}" needs one player start. It has \${starts.length}.\`)
  return { width: level.size.w, height: level.size.h, tile: level.size.w / columns, cells, start: { x: start.x, y: start.y } }
}

/** The level a system finds in \`ctx.content\`: the app gives the sim \`LEVEL\` as its content (src/app/game.ts). */
export const levelIn = (content: unknown): Level => content as Level
`,
  },
  {
    path: 'src/features/level/walls.ts',
    content: () => `import { type Level, SOLID } from './read-level.ts'

// What stops the square: a wall cell, or the edge of the level.

/** True when a square of side \`size\` centred on (x, y) would overlap a wall or reach past the level's edge. */
export function hitsWall(level: Level, x: number, y: number, size: number): boolean {
  const half = size / 2
  const left = x - half
  const top = y - half
  const right = x + half
  const bottom = y + half
  if (left < 0 || top < 0 || right > level.width || bottom > level.height) return true
  // The cells the square covers. Its right and bottom edges are open, so a square resting on the floor (its bottom
  // edge on the floor's top edge) is not inside the floor.
  for (let row = Math.floor(top / level.tile); row < Math.ceil(bottom / level.tile); row++)
    for (let column = Math.floor(left / level.tile); column < Math.ceil(right / level.tile); column++)
      if (level.cells[row]?.[column] === SOLID) return true
  return false
}
`,
  },
  {
    path: 'src/features/level/compiled-content.d.ts',
    content:
      () => `// The content plugin's module (vite.config.ts), typed as far as this game reads it: the compiled levels, by id. The
// plugin also writes a full declaration into content/generated/ on the first \`pnpm dev\` or build; this one lets the
// game type-check before that.
declare module 'virtual:automata/content' {
  export const simContent: { readonly levels?: Readonly<Record<string, unknown>> }
}
`,
  },
  {
    path: 'src/features/level/level.ts',
    content: () => `import { simContent } from 'virtual:automata/content'
import { levelContentSchema } from '@mcthaydt/automata-content/level-2d'
import { type Level, levelOf } from './read-level.ts'

// The level this game plays: content/levels/start.toml, which the 2D editor's Save writes, compiled by the content
// plugin (vite.config.ts). Change it in the editor (\`pnpm exec automata editor\`), then press Save.

const compiled = simContent.levels?.start
if (compiled === undefined) throw new Error('There is no level "start". Open the level in the editor and press Save.')

/** The level, read once: its size, walls and player start. The sim gets it as its content. */
export const LEVEL: Level = levelOf(levelContentSchema.parse(compiled))
`,
  },
  {
    path: 'src/features/level/level.view.ts',
    content: () => `import type { DrawContext } from '@mcthaydt/automata'
import { type Level, SOLID } from './read-level.ts'

/** The walls' colour: the editor's colour for Solid. */
const WALL_COLOR = 0x64748b

/** Draws the level's walls every frame: one rectangle for each run of wall cells in a row. */
export function drawLevel(level: Level): (ctx: DrawContext) => void {
  const runs: { x: number; y: number; w: number }[] = []
  level.cells.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const from = x
      while (row[x] === SOLID) x++
      if (x > from) runs.push({ x: from * level.tile, y: y * level.tile, w: (x - from) * level.tile })
      else x++
    }
  })
  return (ctx) => {
    for (const run of runs) ctx.rect(run.x, run.y, run.w, level.tile, WALL_COLOR)
  }
}
`,
  },
]
