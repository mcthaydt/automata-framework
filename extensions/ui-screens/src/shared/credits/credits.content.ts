// The `credits` content kind: `content/credits/credits.toml` is the game's credits.
import {
  type ContentSchemaDef,
  defineContentSchema,
  localized,
  verbatim,
} from '@automataframework/content/schema'
import type { z } from 'zod'
import { type Credits, creditsSchemaWith } from './credits.schema.ts'

/**
 * The `credits` content kind: `content/credits/credits.toml` is the game's credits. A section's `title` and a name's
 * `role` are translatable; a `name` and a `url` are not. A `name` is `verbatim()`: drawn as written in every language, so
 * the font build keeps its characters in every face and refuses a build in which a language's faces lack one.
 */
export const creditsContent: ContentSchemaDef<'credits', z.ZodType<Credits>> = defineContentSchema(
  'credits',
  creditsSchemaWith(localized(), verbatim()),
  { folder: 'credits' },
)
