// base-3d's sim events: what the sim tells presentation and the screens. Sim code: `pnpm boundaries` checks it.
import { defineEvent, type EventDef } from '@automata/sim'
import { z } from 'zod'

const at = z.object({ x: z.int(), z: z.int() })

/** Wick fell into a channel or pit and was put back on the last safe spot, at the place he fell, Q16.16 metres. */
export const HeroFell: EventDef<typeof at> = defineEvent('hero.fell', at)

/** Wick started a roll, at the place he started it, Q16.16 metres: presentation plays the roll's sound. */
export const HeroRolled: EventDef<typeof at> = defineEvent('hero.rolled', at)
