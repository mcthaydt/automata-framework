import { defineEvent, type EventDef } from '@mcthaydt/automata-sim'
import { z } from 'zod'

// Collision events (M2.1 spec §3.4): `a < b` are the two entities' StableIds; `sensor` when either is a sensor.
const pair: z.ZodObject<{ a: z.ZodNumber; b: z.ZodNumber; sensor: z.ZodBoolean }> = z.object({
  a: z.number().int(),
  b: z.number().int(),
  sensor: z.boolean(),
})

export const CollisionStarted3D: EventDef<typeof pair> = defineEvent('physics3d.collision-started', pair)
export const CollisionEnded3D: EventDef<typeof pair> = defineEvent('physics3d.collision-ended', pair)
