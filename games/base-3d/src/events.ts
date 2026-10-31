// base-3d's sim events (DESIGN.md §3.1): what the sim tells presentation and the screens. Sim code: `pnpm boundaries`
// checks it.
import { defineEvent, type EventDef } from '@mcthaydt/automata-sim'
import { z } from 'zod'

const at = z.object({ x: z.int(), z: z.int() })
const none = z.object({})
const area = z.object({ area: z.int().nonnegative() })

/** Wick picked up the ember, at the ember's place in Q16.16 metres: the play screen ends the run on it. */
export const EmberTaken: EventDef<typeof at> = defineEvent('ember.taken', at)

/**
 * Wick is down: the play screen ends the round as failed and shows the game over (DESIGN.md §7.8). Health is
 * GAME-3D.1c's, which raises it at 0 hearts after `knockdown`; until then nothing in the sim does.
 */
export const HeroDefeated: EventDef<typeof none> = defineEvent('hero.defeated', none)

/** Wick stepped into an exit: presentation fades out, and the sim swaps to `area` `AREA_FADE_TICKS` later. */
export const AreaExit: EventDef<typeof area> = defineEvent('area.exit', area)

/** The sim swapped to `area` and placed Wick at the entry: presentation fades back in. */
export const AreaEntered: EventDef<typeof area> = defineEvent('area.entered', area)
