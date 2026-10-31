// base-3d's resources: the progress a save keeps that the sim itself changes (DESIGN.md §12.1), and the area Wick is
// in (DESIGN.md §13, area change). Sim code.
import { defineResource } from '@mcthaydt/automata-sim'
import { z } from 'zod'

/** Embers taken this game; `screens/saves.ts` captures it into the save and applies it back before tick 0. */
export const Progress = defineResource(
  'progress',
  z.object({ embers: z.number().int().nonnegative() }),
  () => ({
    embers: 0,
  }),
)

/**
 * The area of the world Wick is in, by its index in `World.areas`, and the change under way: `next` is the area an
 * exit leads to (-1 for none), swapped in at tick `swapAt` with Wick at `entryX`, `entryZ` (Q16.16 metres).
 */
export const Location = defineResource(
  'location',
  z.object({
    area: z.number().int().nonnegative(),
    next: z.number().int().min(-1),
    swapAt: z.number().int().nonnegative(),
    entryX: z.number().int(),
    entryZ: z.number().int(),
    /** The room's last entry point, where a fall returns Wick (§7.8): where he crossed into it, facing his way in. */
    returnX: z.number().int(),
    returnZ: z.number().int(),
    returnFacing: z.number().int().nonnegative(),
  }),
  () => ({ area: 0, next: -1, swapAt: 0, entryX: 0, entryZ: 0, returnX: 0, returnZ: 0, returnFacing: 0 }),
)

/**
 * What Wick carries (DESIGN.md §9.1, §9.3): the items he owns, the one on the Item button (`ItemCode`, 0 none), his
 * pellets and bombs, and how many ticks Item has been held running (the sling's draw). `screens/saves.ts` applies it
 * from the save before tick 0 and captures it back.
 */
export const Inventory = defineResource(
  'inventory',
  z.object({
    sling: z.boolean(),
    bombs: z.boolean(),
    hookchain: z.boolean(),
    equipped: z.number().int().min(0).max(3),
    pellets: z.number().int().nonnegative(),
    bombAmmo: z.number().int().nonnegative(),
    draw: z.number().int().nonnegative(),
  }),
  () => ({ sling: false, bombs: false, hookchain: false, equipped: 0, pellets: 0, bombAmmo: 0, draw: 0 }),
)

/**
 * Hitstop (DESIGN.md §7.5, GAME3D-D6): the ticks still frozen, and whether this tick is one. While `active`, every
 * system but the input copy and `combat.freeze` stands still.
 */
export const Freeze = defineResource(
  'freeze',
  z.object({ ticks: z.number().int().nonnegative(), active: z.boolean() }),
  () => ({ ticks: 0, active: false }),
)
