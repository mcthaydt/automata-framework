// The `feel` content kind: `content/feel.toml` is the game's feel table.
import { type ContentSchemaDef, defineContentSchema } from '@automata/content/schema'
import type { z } from 'zod'
import { type FeelContent, feelSchema } from '../../shared/feel.schema'

/** The `feel` content kind: `content/feel.toml` is the game's feel table. */
export const feelContent: ContentSchemaDef<'feel', z.ZodType<FeelContent>> = defineContentSchema(
  'feel',
  feelSchema,
  {
    folder: 'feel',
  },
)
