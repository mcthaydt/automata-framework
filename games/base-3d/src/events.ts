// base-3d's sim events (DESIGN.md §3.1): what the sim tells presentation and the screens. Sim code: `pnpm boundaries`
// checks it.
import { defineEvent, type EventDef } from '@mcthaydt/automata-sim'
import { z } from 'zod'

const at = z.object({ x: z.int(), z: z.int() })

/** Wick picked up the ember, at the ember's place in Q16.16 metres: the play screen ends the run on it. */
export const EmberTaken: EventDef<typeof at> = defineEvent('ember.taken', at)
