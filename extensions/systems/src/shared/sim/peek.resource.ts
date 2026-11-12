// The peek, in the sim's state so snapshots and replays carry it: the player's peek now, or none.
import { defineResource, type ResourceDef } from '@automataframework/sim'
import { z } from 'zod'
import type { PeekState } from './peek'

export interface PeekValue {
  peek: PeekState | null
}
const peekSchema: z.ZodType<PeekValue> = z.strictObject({
  peek: z
    .strictObject({
      portal: z.string(),
      into: z.string(),
      t: z.number(),
      on: z.boolean(),
      x: z.number(),
      z: z.number(),
    })
    .nullable(),
})
export const SystemsPeekState: ResourceDef<typeof peekSchema> = defineResource(
  'systems.peek-state',
  peekSchema,
  () => ({
    peek: null,
  }),
)
