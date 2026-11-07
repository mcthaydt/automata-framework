// The `feel` content kind (M6 spec §4.1): `content/feel.toml` is the game's feel table.
import { type ContentSchemaDef, defineContentSchema } from '@mcthaydt/automata-content'
import type { z } from 'zod'
import { type FeelContent, feelSchema } from './feel.schema'

export const feelContent: ContentSchemaDef<'feel', z.ZodType<FeelContent>> = defineContentSchema(
  'feel',
  feelSchema,
  {
    folder: 'feel',
  },
)
