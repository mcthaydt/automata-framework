import { defineResource, type ResourceDef } from '@automata/sim'
import { z } from 'zod'

const value = z.union([z.string(), z.number(), z.boolean()])

/**
 * The one checkpoint the prologue keeps, made at lights out (call 10 of the plan: it moves to an extension when the clinic
 * needs one), and whether a catch is waiting for its cutscene to end before it puts everything back. What it holds is what
 * a practice catch undoes: the facts and items, where Ada stood, and the lamp.
 */
export interface CheckpointValue {
  /** Whether a checkpoint has been made. */
  saved: boolean
  facts: Record<string, string | number | boolean>
  items: string[]
  ada: { x: number; z: number }
  /** The lamp as it was, or null when she had none. */
  lamp: { lit: boolean; fuelTicks: number } | null
  /** A catch has begun its cutscene; the restore waits for it to end. */
  pending: boolean
}

const checkpointSchema: z.ZodType<CheckpointValue> = z.strictObject({
  saved: z.boolean(),
  facts: z.record(z.string(), value),
  items: z.array(z.string()),
  ada: z.strictObject({ x: z.number(), z: z.number() }),
  lamp: z.strictObject({ lit: z.boolean(), fuelTicks: z.number().int() }).nullable(),
  pending: z.boolean(),
})

export const Checkpoint: ResourceDef<typeof checkpointSchema> = defineResource(
  'checkpoint',
  checkpointSchema,
  () => ({
    saved: false,
    facts: {},
    items: [],
    ada: { x: 0, z: 0 },
    lamp: null,
    pending: false,
  }),
)
