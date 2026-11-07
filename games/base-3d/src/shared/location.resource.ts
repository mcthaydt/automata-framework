// base-3d's last safe spot, where a fall returns Wick. Sim code: `pnpm boundaries` checks it.
import { defineResource } from '@automata/sim'
import { z } from 'zod'

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
