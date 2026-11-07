// The `time-of-day` content kind: a game's own times of day, one TOML file each under `content/times-of-day/`,
// kept out of the sim (light is presentation, law 1). A level names one by its file name; the library's six are
// there without a file. Registered by `render3dExtension`, so it imports content's browser-safe `/schema` entry.

import { type ContentSchemaDef, defineContentSchema } from '@automata/content/schema'
import { timeOfDaySchema } from './time-of-day.schema.ts'

export const timeOfDayContent: ContentSchemaDef<'time-of-day', typeof timeOfDaySchema> = defineContentSchema(
  'time-of-day',
  timeOfDaySchema,
  { folder: 'times-of-day' },
  { sim: false },
)
