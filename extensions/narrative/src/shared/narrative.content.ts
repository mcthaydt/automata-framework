// Narrative's content kinds: the canon's shape (`content/canon`), each scene's line records
// (`content/lines`), its dialogue graphs (`content/dialogue`), its storylet deck (`content/storylets`), its beats
// (`content/beats`) and its puzzle help (`content/help`). Each schema
// checks its references at their paths, so the compiler names the file and line.
import { type ContentSchemaDef, defineContentSchema, localized } from '@automata/content/schema'
import type { z } from 'zod'
import { type BeatsFile, beatsFileSchema } from './beats.schema'
import { helpFileSchema, type SceneHelp } from './help.schema'
import { type Canon, canonSchema } from './sim/canon.schema'
import { type DialogueFile, dialogueFileSchema } from './sim/dialogue.schema'
import { type LinesFile, linesFileSchemaWith } from './sim/lines.schema'
import { type StoryletsFile, storyletsFileSchema } from './sim/storylet.schema'

export const canonContent: ContentSchemaDef<'canon', z.ZodType<Canon>> = defineContentSchema(
  'canon',
  canonSchema,
  {
    folder: 'canon',
  },
)
// A line's words are what the player reads, so translators get them; the sim's own schema takes them as plain text.
export const linesContent: ContentSchemaDef<'lines', z.ZodType<LinesFile>> = defineContentSchema(
  'lines',
  linesFileSchemaWith(localized()),
  { folder: 'lines' },
)
export const dialogueContent: ContentSchemaDef<'dialogue', z.ZodType<DialogueFile>> = defineContentSchema(
  'dialogue',
  dialogueFileSchema,
  { folder: 'dialogue' },
)
export const storyletsContent: ContentSchemaDef<'storylets', z.ZodType<StoryletsFile>> = defineContentSchema(
  'storylets',
  storyletsFileSchema,
  { folder: 'storylets' },
)
export const beatsContent: ContentSchemaDef<'beats', z.ZodType<BeatsFile>> = defineContentSchema(
  'beats',
  beatsFileSchema,
  { folder: 'beats' },
)
export const helpContent: ContentSchemaDef<'help', z.ZodType<SceneHelp>> = defineContentSchema(
  'help',
  helpFileSchema,
  { folder: 'help' },
)
