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

const fallen = z.object({ target: z.int().nonnegative(), x: z.int(), z: z.int() })

/** A foe's health reached 0, where it stood (Q16.16 metres): it is despawned at the end of the tick, and bursts into
 * ash (presentation, DESIGN.md §8.1 rule 6). */
export const FoeDefeated: EventDef<typeof fallen> = defineEvent('foe.defeated', fallen)

const drop = z.object({ kind: z.int().positive(), amount: z.int().positive(), x: z.int(), z: z.int() })

/** Wick took a drop (an ember or a heart) at its place: presentation's pickup sound and sparkle. */
export const DropTaken: EventDef<typeof drop> = defineEvent('drop.taken', drop)

/** The Ash Knight Captain is beaten (DESIGN.md §8.3): D4's doors open and the Ember Bombs chest appears (1f, 1e). */
export const CaptainDefeated: EventDef<typeof foe> = defineEvent('captain.defeated', foe)

const shot = z.object({ item: z.enum(['sling', 'hookchain']), x: z.int(), z: z.int() })

/** Wick fired an item from his place (DESIGN.md §9.1): presentation's twang. */
export const ShotFired: EventDef<typeof shot> = defineEvent('shot.fired', shot)

const blast = z.object({ x: z.int(), z: z.int() })

/** A bomb blasted at its place (DESIGN.md §9.1): presentation's flash and boom. */
export const BombBlast: EventDef<typeof blast> = defineEvent('bomb.blast', blast)

const hooked = z.object({ x: z.int(), z: z.int() })

/** The Hookchain caught a hook post at its place (DESIGN.md §9.1): the clank, and the pull begins. */
export const ChainHooked: EventDef<typeof hooked> = defineEvent('chain.hooked', hooked)

const phase = z.object({ target: z.int().nonnegative(), phase: z.int().positive() })

/** The Warden entered `phase` (DESIGN.md §8.4): the grate shuts; presentation's cue. */
export const BossPhase: EventDef<typeof phase> = defineEvent('boss.phase', phase)

/** The Warden is beaten (DESIGN.md §8.4): the hearth shot, then the end screen (GAME-3D.1d part 4). */
export const BossDefeated: EventDef<typeof foe> = defineEvent('boss.defeated', foe)
