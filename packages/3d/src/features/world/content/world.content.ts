// The world's content kinds: the swatches, prop presets and kits a level names. Presentation only (law 1), so they
// stay out of the sim's partition and hash. The core library (`../library.ts`) has the ones every game gets; a
// game's own, one TOML file each under `content/`, are merged over them by the game.
import { type ContentSchemaDef, defineContentSchema } from '@automata/content/schema'
import { worldPropSchema } from './world-prop.schema.ts'
import { worldSwatchSchema } from './world-swatch.schema.ts'

const presentation = { sim: false } as const

export const worldSwatchContent: ContentSchemaDef<'world-swatch'> = defineContentSchema(
  'world-swatch',
  worldSwatchSchema,
  { folder: 'world-swatches' },
  presentation,
)
export const worldPropContent: ContentSchemaDef<'world-prop'> = defineContentSchema(
  'world-prop',
  worldPropSchema,
  { folder: 'world-props' },
  presentation,
)
