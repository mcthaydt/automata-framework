// base-3d's resources: the progress a save keeps that the sim itself changes, and the last safe spot. Sim code.
import { defineResource } from '@mcthaydt/automata-sim'
import { z } from 'zod'

/**
 * The embers taken this game, by their index in the area's list (sorted), and whether the goal was reached;
 * `screens/saves.ts` captures and applies them.
 */
export const Progress = defineResource(
  'progress',
  z.object({ taken: z.array(z.number().int().nonnegative()), goal: z.boolean() }),
  () => ({ taken: [], goal: false }),
)

/**
 * The room's last entry point, where a fall returns Wick: where he crossed into it, facing his way in (Q16.16
 * metres, turn units). The spawn until he crosses into another room.
 */
export const Location = defineResource(
  'location',
  z.object({
    returnX: z.number().int(),
    returnZ: z.number().int(),
    returnFacing: z.number().int().nonnegative(),
  }),
  () => ({ returnX: 0, returnZ: 0, returnFacing: 0 }),
)
