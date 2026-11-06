import type { ContentSchemaDef } from '../schema/content-schema.ts'
import { defineContentSchema } from '../schema/content-schema.ts'
import { levelContentSchema, projectContentSchema, worldContentSchema } from './content.schema.ts'

// The three content kinds a game registers to read what the 2D editor exports: `levels/<id>.toml`, `project.toml` and
// `world.toml`. The levels are gameplay, so the sim receives them; the project's definitions and the world's
// placements are for the editor and the tools, so they stay out of the sim's content and its hash. The schemas are
// strict: a level the editor did not write fails the compile with the schema's message and the file's path.

/** Options for `level2dKinds`. */
export interface Level2dKindsOptions {
  /** Where the exported levels are, under `content/`. Default `levels`. */
  readonly folder?: string | undefined
}

/** The kinds `levels` (in the sim's content), `project` and `world` (outside it). */
export function level2dKinds(options: Level2dKindsOptions = {}): ContentSchemaDef[] {
  return [
    defineContentSchema('levels', levelContentSchema, { folder: options.folder ?? 'levels' }),
    defineContentSchema('project', projectContentSchema, { file: 'project.toml' }, { sim: false }),
    defineContentSchema('world', worldContentSchema, { file: 'world.toml' }, { sim: false }),
  ]
}
