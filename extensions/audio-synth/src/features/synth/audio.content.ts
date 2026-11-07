// The `audio` content kind: `content/audio/*.toml` holds a game's cues, beds, event map, ducking and music.
import { type ContentSchemaDef, defineContentSchema } from '@automata/content/schema'
import type { z } from 'zod'
import { type AudioContent, audioSchema } from '../../shared/audio.schema'

/**
 * The `audio` content kind: `content/audio/*.toml` holds a game's cues, beds, event map, ducking
 * and music.
 */
export const audioContent: ContentSchemaDef<'audio', z.ZodType<AudioContent>> = defineContentSchema(
  'audio',
  audioSchema,
  {
    folder: 'audio',
  },
)
