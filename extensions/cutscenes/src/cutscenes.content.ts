// The `cutscene` content kind (M6 spec §4.8): every TOML file in `content/cutscenes` is one script.
import { type ContentSchemaDef, defineContentSchema } from '@automata/content/schema'
import type { z } from 'zod'
import { type CutsceneScript, cutsceneSchema } from './sim/cutscene.schema'

export const cutsceneContent: ContentSchemaDef<'cutscene', z.ZodType<CutsceneScript>> = defineContentSchema(
  'cutscene',
  cutsceneSchema,
  { folder: 'cutscenes' },
)
