// The `carried-light` content kind: `content/carried-light.toml`, the numbers of a hand lamp or a torch as data with a schema,
// so a person (and soon an editor) changes how far its pool reaches, the fuel it starts with, what a refill gives, what it
// holds and how fast it burns, and the content compiler names the file and line of a number that cannot be one. Every number is
// optional and a missing one is the old game's. It is sim content: the sim's content hash covers it, since it decides how long
// a light lasts.
import { type ContentSchemaDef, defineContentSchema } from '@automata/content/schema'
import { z } from 'zod'
import { type CarriedLightFile, carriedLightProblems } from './sim/carried-light'

export const carriedLightFileSchema: z.ZodType<CarriedLightFile> = z
  .strictObject({
    radius: z.number().optional(),
    start: z.number().optional(),
    fill: z.number().optional(),
    cap: z.number().optional(),
    burn: z.number().optional(),
  })
  .superRefine((def, context) => {
    for (const { name, message } of carriedLightProblems(def))
      context.addIssue({ code: 'custom', path: [name], message })
  })

/** The kind a game registers (beside `createCarriedLight`) to read `content/carried-light.toml`; pass the file to `carriedLightDefOf`. */
export const carriedLightContent: ContentSchemaDef<
  'carried-light',
  z.ZodType<CarriedLightFile>
> = defineContentSchema('carried-light', carriedLightFileSchema, { file: 'carried-light.toml' })
