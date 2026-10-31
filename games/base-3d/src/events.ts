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
 * Wick is down: the play screen ends the round as failed and shows the game over (DESIGN.md §7.8). `combat.status`
 * raises it once, when his `knockdown` at 0 health ends.
 */
export const HeroDefeated: EventDef<typeof none> = defineEvent('hero.defeated', none)

/** Wick stepped into an exit: presentation fades out, and the sim swaps to `area` `AREA_FADE_TICKS` later. */
export const AreaExit: EventDef<typeof area> = defineEvent('area.exit', area)

/** The sim swapped to `area` and placed Wick at the entry: presentation fades back in. */
export const AreaEntered: EventDef<typeof area> = defineEvent('area.entered', area)

const hit = z.object({
  attacker: z.int().nonnegative(),
  target: z.int().nonnegative(),
  kind: z.enum(['hit', 'block', 'parry']),
  power: z.int().nonnegative(),
  x: z.int(),
  z: z.int(),
})

/** A hit landed, was blocked or was parried, at the defender's place: the sparks and the shake (GAME-3D.1c part 3). */
export const HitLanded: EventDef<typeof hit> = defineEvent('hit.landed', hit)

const foe = z.object({ target: z.int().nonnegative() })

/** A foe's health reached 0; it is despawned at the end of the tick. */
export const FoeDefeated: EventDef<typeof foe> = defineEvent('foe.defeated', foe)

const drop = z.object({ kind: z.int().positive(), amount: z.int().positive(), x: z.int(), z: z.int() })

/** Wick took a drop (an ember or a heart) at its place: presentation's pickup sound and sparkle. */
export const DropTaken: EventDef<typeof drop> = defineEvent('drop.taken', drop)
