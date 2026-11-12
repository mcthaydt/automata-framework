// A carried light that is out of fuel: it went out as the last of its fuel burned, or was lit with none.
import { defineEvent, type EventDef } from '@automataframework/sim'
import { z } from 'zod'

const drySchema: z.ZodType<Record<string, never>> = z.strictObject({})
export const LightDry: EventDef<z.ZodType<Record<string, never>>> = defineEvent(
  'systems.light-dry',
  drySchema,
)
