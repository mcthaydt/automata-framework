// The `world-kit` content kind: every TOML file in `content/world-kits` is one purpose kit (what a room of that purpose
// holds). Presentation only, so it stays out of the sim's partition and hash.
import { type ContentSchemaDef, defineContentSchema } from '@automata/content/schema'
import { worldKitSchema } from './kit.schema.ts'

export const worldKitContent: ContentSchemaDef<'world-kit'> = defineContentSchema(
  'world-kit',
  worldKitSchema,
  { folder: 'world-kits' },
  { sim: false },
)
