import type { TemplateFile } from './template-file.ts'

// The new game's level feature: the level the 2D editor exported, read into walls and a start; the wall test the sim
// runs; and the level scene core draws from the same files. The level itself is in the game's `content/`
// (template-content.ts).

/** The level feature: the editor's level read into walls and a start, the wall test the sim runs, and the scene drawn. */
export const LEVEL_FILES: readonly TemplateFile[] = [
  {
    path: 'src/features/level/read-level.ts',
    content: () => `import { type ContentLevel, entitiesOf, intGridRows } from '@automata/content/level-2d'

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
      () => `// The content plugin's module (vite.config.ts), typed as far as this game reads it: the compiled levels, by id, and the
// editor's project and levels that the screen draws, the default controls, and what Feel and Audio write. The plugin also writes a full declaration into content/generated/
// on the first \`pnpm dev\` or build; this one lets the game type-check before that.
declare module 'virtual:automata/content' {
  export const simContent: { readonly levels?: Readonly<Record<string, unknown>> }
  export const content: {
    readonly project?: unknown
    readonly controls?: unknown
    readonly levels?: Readonly<Record<string, unknown>>
    readonly feel?: Readonly<Record<string, unknown>>
    readonly audio?: Readonly<Record<string, unknown>>
  }
}
`,
  },
  {
    path: 'src/features/level/level.ts',
    content: () => `import { simContent } from 'virtual:automata/content'
import { levelContentSchema } from '@automata/content/level-2d'
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
    path: 'src/features/level/level-scene.ts',
    content: () => `import { content } from 'virtual:automata/content'
import { levelContentSchema, projectContentSchema } from '@automata/content/level-2d'
import { levelScene } from '@automata/framework'

// What the game shows of the level: core draws the tiles, auto tiles, objects and placed characters the editor made,
// from the same files the sim reads. Press Save in the editor and the game shows the change.

/** The pictures Add tiles put in \`assets/\`, by the path the editor knows them by (\`assets/terrain.png\`). */
const found: Record<string, string> = import.meta.glob('/assets/*.{png,webp,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default',
})
export const images: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(found).map(([path, url]) => [path.slice(1), url]),
)

/** The editor's project: the characters, tilesets and layers the levels are made from. */
export const project = projectContentSchema.parse(content.project)

const levels = Object.fromEntries(
  Object.entries(content.levels ?? {}).map(([id, level]) => [id, levelContentSchema.parse(level)]),
)

/**
 * The scene. The square is the player start, so the game draws it itself (\`live\`); an area is a zone, not a picture.
 */
export const LEVEL_SCENE = levelScene({ project, levels, images, start: 'start', live: ['player-start', 'area'] })
`,
  },
]
