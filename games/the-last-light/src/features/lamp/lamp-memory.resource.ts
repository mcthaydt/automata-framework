import { defineResource, type ResourceDef } from '@automata/sim'
import { z } from 'zod'

/** The lamp as it stood at the start of the step, so a step that must not burn it can put it back. */
export interface LampMemoryValue {
  /** Whether a light was remembered at all (Ada has the lamp). */
  has: boolean
  lit: boolean
  fuelTicks: number
}

const schema: z.ZodType<LampMemoryValue> = z.strictObject({
  has: z.boolean(),
  lit: z.boolean(),
  fuelTicks: z.number().int(),
})

export const LampMemory: ResourceDef<typeof schema> = defineResource('lamp.memory', schema, () => ({
  has: false,
  lit: false,
  fuelTicks: 0,
}))
