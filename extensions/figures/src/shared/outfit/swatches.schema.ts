import { z } from 'zod'
import type { Material } from '../body/parts'
import { asWritten } from '../math/as-written'

const n = z.number()
const ramp = z.array(z.string())

/** A swatch (library/swatches.json): a material, as the painter reads it (body/parts.ts Material). */
export const swatchSchema = z.strictObject({
  ramp: n,
  base: n,
  lift: n.optional(),
  flat: z.boolean().optional(),
  gloss: n.optional(),
  strands: z.boolean().optional(),
  sheen: z.boolean().optional(),
  streaks: n.optional(),
  paint: ramp.optional(),
  tones: z.tuple([n, n, n]).optional(),
  mix: z.strictObject({ from: ramp, to: ramp, at: n, edge: n.optional() }).optional(),
  stain: z.strictObject({ paint: ramp, hem: n, below: n }).optional(),
  holo: z.union([z.boolean(), z.literal('mirror')]).optional(),
  see: z.boolean().optional(),
  fabric: z.string().optional(),
}) satisfies z.ZodType<Material>

/** The whole file: swatches by name. */
export const swatchesSchema = asWritten(z.record(z.string(), swatchSchema))
