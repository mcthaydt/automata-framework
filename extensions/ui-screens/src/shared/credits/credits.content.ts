// The `credits` content kind: `content/credits/credits.toml` is the game's credits.
import { type ContentSchemaDef, defineContentSchema, localized } from '@automata/content/schema'
import type { z } from 'zod'
import { type Credits, creditsSchemaWith } from './credits.schema.ts'

/**
 * The `credits` content kind: `content/credits/credits.toml` is the game's credits. A section's `title` and a name's
 * `role` are translatable; a `name` and a `url` are not.
 */
export const creditsContent: ContentSchemaDef<'credits', z.ZodType<Credits>> = defineContentSchema(
  'credits',
  creditsSchemaWith(localized()),
  { folder: 'credits' },
)
