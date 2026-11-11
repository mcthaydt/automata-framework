// The `peek` content kind: `content/peek.toml`, the numbers of a peek as data with a schema, so a person (and soon an
// editor) changes how long the player must stand still, how far she may be from a doorway, how far off it she may face and how
// far the camera leans, and the content compiler names the file and line of a number that cannot be one. Every number is
// optional and a missing one is the old game's. It is sim content: the sim's content hash covers it, since it decides who peeks.
import { type ContentSchemaDef, defineContentSchema } from '@automata/content/schema'
import { z } from 'zod'
import { type PeekFile, peekProblems } from './sim/peek'

export const peekFileSchema: z.ZodType<PeekFile> = z
  .strictObject({
    reach: z.number().optional(),
    dwell: z.number().optional(),
    arc: z.number().optional(),
    lean: z.number().optional(),
    ease: z.number().optional(),
  })
  .superRefine((def, context) => {
    for (const { name, message } of peekProblems(def))
      context.addIssue({ code: 'custom', path: [name], message })
  })

/** The kind a game registers (beside `createPeek`) to read `content/peek.toml`; pass the file's numbers to `peekDefOf`. */
export const peekContent: ContentSchemaDef<'peek', z.ZodType<PeekFile>> = defineContentSchema(
  'peek',
  peekFileSchema,
  { file: 'peek.toml' },
)
