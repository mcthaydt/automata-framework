// base-3d's progress: the embers taken and whether the goal was reached, which a save keeps and the sim changes. Sim code.
import { defineResource } from '@automata/sim'
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
