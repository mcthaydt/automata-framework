import { z } from 'zod'
import { asWritten } from '../math/as-written'
import { gaitSchema } from '../motion/gaits.schema'
import type { Spec } from './pose-spec'

const n = z.number()
const v3 = z.tuple([n, n, n])

/** What a pose spec says of the acting arm (pose-spec.ts ArmSpec). */
const armSpec = z.strictObject({
  w: n.optional(),
  d: v3.optional(),
  r: n.optional(),
  pole: v3.optional(),
  to: z.enum(['target', 'meet']).optional(),
  bob: n.optional(),
})
/** What a pose spec says of a foot (pose-spec.ts FootSpec). */
const footSpec = z.strictObject({ at: v3.optional(), turn: n.optional(), pitch: n.optional() })
/** A pose spec (pose-spec.ts): the numbers that say what a body does at one key. */
export const specSchema = z.strictObject({
  pel: v3.optional(),
  pelR: v3.optional(),
  hip: n.optional(),
  seat: n.optional(),
  chest: v3.optional(),
  head: v3.optional(),
  sh: n.optional(),
  face: n.optional(),
  A: armSpec.optional(),
  B: armSpec.optional(),
  fA: footSpec.optional(),
  fB: footSpec.optional(),
  stance: n.optional(),
}) satisfies z.ZodType<Spec>

const actionDef = z.strictObject({
  about: z.string().optional(),
  body: z.enum(['upper', 'full']),
  hand: z.enum(['main', 'free', 'either']).optional(),
  anticipation: n,
  action: n,
  recovery: n,
  enter: n.optional(),
  hold: z.boolean().optional(),
  loop: z.tuple([n, n]).optional(),
  keys: z.array(z.tuple([n, specSchema])),
  targeted: z.boolean().optional(),
  untargeted: z.string().optional(),
})
const aliasDef = z.strictObject({
  about: z.string().optional(),
  alias: z.strictObject({ item: z.string(), bare: z.string() }),
})

/** A mode of the gait an action file names (a run, a crouch): the gait's numbers scaled and set. */
const mode = z.strictObject({
  about: z.string().optional(),
  scale: gaitSchema.partial().extend({ shuffle: n.optional() }).optional(),
  set: gaitSchema.partial().optional(),
})

/** The action library (library/actions.json): the gait's modes and the actions by name. The reader types what this returns as `ActionDef | AliasDef`, which is the check that the schema's output fits it; the schema does not import the reader's type (that is a cycle the layer test refuses). */
export const actionsSchema = asWritten(
  z.strictObject({
    about: z.string().optional(),
    modes: z.record(z.string(), mode),
    actions: z.record(z.string(), z.union([actionDef, aliasDef])),
  }),
)
