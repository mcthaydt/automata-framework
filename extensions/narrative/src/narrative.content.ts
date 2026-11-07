// Narrative's content kinds (M6 spec §4.7, §6): the canon's shape (`content/canon`), each scene's line records
// (`content/lines`), its dialogue graphs (`content/dialogue`), its storylet deck (`content/storylets`), its beats
// (`content/beats`) and its puzzle help (`content/help`). Each schema
// checks its references at their paths, so the compiler names the file and line.
import { type ContentSchemaDef, defineContentSchema } from '@automata/content/schema'
import type { z } from 'zod'
import {
  type Canon,
  canonSchema,
  type DialogueFile,
  dialogueFileSchema,
  type LinesFile,
  linesFileSchema,
  type StoryletsFile,
  storyletsFileSchema,
} from './sim/index'
import { type BeatsFile, beatsFileSchema } from './tools/beats.schema'
import { helpFileSchema, type SceneHelp } from './tools/help.schema'

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
