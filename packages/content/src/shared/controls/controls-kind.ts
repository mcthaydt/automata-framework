import type { ContentSchemaDef } from '../schema/content-schema.ts'
import { defineContentSchema } from '../schema/content-schema.ts'
import { controlsFileSchema } from './controls.schema.ts'

// The controls are for the game's input map and the Tuner. They are not gameplay state, so the sim does not receive
// them and they stay out of its content hash.

/** The kind a game registers to read `content/controls.toml`. */
export function controlsKind(): ContentSchemaDef {
  return defineContentSchema('controls', controlsFileSchema, { file: 'controls.toml' }, { sim: false })
}
