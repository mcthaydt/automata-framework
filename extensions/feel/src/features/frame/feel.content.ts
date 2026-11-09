// The `feel` content kind: `content/feel.toml` is the game's feel table.
import { type ContentSchemaDef, defineContentSchema, localized } from '@automata/content/schema'
import type { z } from 'zod'
import { type FeelContent, feelSchemaWith } from '../../shared/feel.schema'

/** The `feel` content kind: `content/feel/feel.toml` is the game's feel table; a word's `words` is translatable. */
export const feelContent: ContentSchemaDef<'feel', z.ZodType<FeelContent>> = defineContentSchema(
  'feel',
  feelSchemaWith(localized()),
  {
    folder: 'feel',
  },
)
