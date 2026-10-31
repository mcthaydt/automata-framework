// Narrative's content kinds (M6 spec §4.7, §6): the canon's shape (`content/canon`), each scene's line records
// (`content/lines`), its dialogue graphs (`content/dialogue`) and its storylet deck (`content/storylets`). Each schema
// checks its references at their paths, so the compiler names the file and line.
import { type ContentSchemaDef, defineContentSchema } from '@mcthaydt/automata-content'
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
