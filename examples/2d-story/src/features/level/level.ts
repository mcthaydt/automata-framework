import { simContent } from 'virtual:automata/content'
import { levelContentSchema } from '@automata/content/level-2d'
import { type Level, levelOf } from './read-level.ts'

// The level this game plays: content/levels/start.toml, which the 2D editor's Save writes, compiled by the content
// plugin (vite.config.ts). Change it in the editor (`pnpm exec automata editor`), then press Save.

const compiled = simContent.levels?.start
if (compiled === undefined)
  throw new Error('There is no level "start". Open the level in the editor and press Save.')

/** The level, read once: its size, walls and player start. The sim gets it as its content. */
export const LEVEL: Level = levelOf(levelContentSchema.parse(compiled))
