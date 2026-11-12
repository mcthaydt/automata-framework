// The `hud` content kind: every TOML file in `content/hud` is one HUD. The sim never receives it (a HUD is presentation).
import { type ContentSchemaDef, defineContentSchema } from '@automataframework/content/schema'
import type { z } from 'zod'
import { type HudFile, hudSchema } from './hud.schema'

export const hudContent: ContentSchemaDef<'hud', z.ZodType<HudFile>> = defineContentSchema(
  'hud',
  hudSchema,
  { folder: 'hud' },
  { sim: false },
)
