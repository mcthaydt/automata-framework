// Narrative's content kinds: the canon's shape (`content/canon`), each scene's line records
// (`content/lines`), its dialogue graphs (`content/dialogue`), its storylet deck (`content/storylets`), its beats
// (`content/beats`) and its puzzle help (`content/help`). Each schema
// checks its references at their paths, so the compiler names the file and line.
import { type ContentSchemaDef, defineContentSchema } from '@automata/content/schema'
import type { z } from 'zod'
import { type BeatsFile, beatsFileSchema } from '../../shared/beats.schema'
import { helpFileSchema, type SceneHelp } from '../../shared/help.schema'
import { type Canon, canonSchema } from '../../shared/sim/canon.schema'
import { type DialogueFile, dialogueFileSchema } from '../../shared/sim/dialogue.schema'
import { type LinesFile, linesFileSchema } from '../../shared/sim/lines.schema'
import { type StoryletsFile, storyletsFileSchema } from '../../shared/sim/storylet.schema'

export const canonContent: ContentSchemaDef<'canon', z.ZodType<Canon>> = defineContentSchema(
  'canon',
  canonSchema,
  {
    folder: 'canon',
  },
)
export const linesContent: ContentSchemaDef<'lines', z.ZodType<LinesFile>> = defineContentSchema(
  'lines',
  linesFileSchema,
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
