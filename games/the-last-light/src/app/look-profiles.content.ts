import { defineContentSchema } from '@automata/content/schema'
import { lcdProfileSchema } from '@automata/lcd-panel'
import { retroProfileSchema } from '@automata/retro-crisp'
import { z } from 'zod'

// The profiles of the picture's two passes (`app/look-passes.ts`): the old game's retro grade and LCD panel. The numbers are the old
// game's, which are the two extensions' defaults, so `content/look.toml` holds only the keys the game changes. Presentation only: the
// file is not the sim's, so it is outside its hash. This file holds the schema alone, so the build's config can read it without the renderer.

/** What `content/look.toml` says: each pass's profile. A setting out of range or unknown is refused, naming it. */
export const lookProfilesSchema = z.strictObject({
  retro: retroProfileSchema.default(() => retroProfileSchema.parse({})),
  lcd: lcdProfileSchema.default(() => lcdProfileSchema.parse({})),
})

export type LookProfiles = z.infer<typeof lookProfilesSchema>

/** The kind the game registers (vite.config.ts) to read `content/look.toml`. */
export const lookProfilesContent = defineContentSchema(
  'look',
  lookProfilesSchema,
  { file: 'look.toml' },
  { sim: false },
)
