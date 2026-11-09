import { defineEvent, type EventDef } from '@automata/sim'
import { z } from 'zod'

// Collision events: `a < b` are the two entities' StableIds; `sensor` when either is a sensor.
const pair: z.ZodObject<{ a: z.ZodNumber; b: z.ZodNumber; sensor: z.ZodBoolean }> = z.object({
  a: z.number().int(),
  b: z.number().int(),
  sensor: z.boolean(),
})

/**
 * Two colliders began touching (or, with a sensor, overlapping). `a` and `b` are the entities' StableIds, `a`
 * the lower, and `sensor` is true when either collider is a sensor. Emitted in `postPhysics`, in `(a, b)`
 * order, after that tick's ended events.
 */
export const CollisionStarted2D: EventDef<typeof pair> = defineEvent('physics2d.collision-started', pair)
/**
 * Two colliders stopped touching, or one was removed. The payload is the one of `CollisionStarted2D`; ended
 * events come before started events in a tick.
 */
export const CollisionEnded2D: EventDef<typeof pair> = defineEvent('physics2d.collision-ended', pair)
