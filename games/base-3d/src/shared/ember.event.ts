// base-3d's ember events: what the sim tells presentation and the screens about the embers. Sim code: `pnpm boundaries` checks it.
import { defineEvent, type EventDef } from '@automata/sim'
import { z } from 'zod'

const at = z.object({ x: z.int(), z: z.int() })
const none = z.object({})

/** Wick took an ember, at its place in Q16.16 metres. */
export const EmberTaken: EventDef<typeof at> = defineEvent('ember.taken', at)

/** Wick took the goal ember: the play screen ends the round as complete and shows the end screen. */
export const GoalReached: EventDef<typeof none> = defineEvent('goal.reached', none)
