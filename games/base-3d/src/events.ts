// base-3d's sim events: what the sim tells presentation and the screens. Sim code: `pnpm boundaries` checks it.
import { defineEvent, type EventDef } from '@mcthaydt/automata-sim'
import { z } from 'zod'

const at = z.object({ x: z.int(), z: z.int() })
const none = z.object({})

/** Wick took an ember, at its place in Q16.16 metres. */
export const EmberTaken: EventDef<typeof at> = defineEvent('ember.taken', at)

/** Wick took the goal ember: the play screen ends the round as complete and shows the end screen. */
export const GoalReached: EventDef<typeof none> = defineEvent('goal.reached', none)

/** Wick fell into a channel or pit and was put back on the last safe spot, at the place he fell, Q16.16 metres. */
export const HeroFell: EventDef<typeof at> = defineEvent('hero.fell', at)

/** Wick started a roll, at the place he started it, Q16.16 metres: presentation plays the roll's sound. */
export const HeroRolled: EventDef<typeof at> = defineEvent('hero.rolled', at)
