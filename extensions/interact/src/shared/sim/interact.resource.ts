// Interact's state: the level's hotspots, and the one use that is waiting for the walker. It is in the snapshot, so a
// restored game goes on with the walk it was on.
import { defineResource, type ResourceDef } from '@automataframework/sim'
import { z } from 'zod'
import { type Hotspot, hotspotSchema } from './hotspot.schema'
import type { Pending } from './pending'

export interface InteractStateValue {
  hotspots: Hotspot[]
  pending: Pending | null
}
const stateSchema: z.ZodType<InteractStateValue> = z.strictObject({
  hotspots: z.array(hotspotSchema),
  pending: z.strictObject({ at: z.string(), held: z.string().optional() }).nullable(),
}) as z.ZodType<InteractStateValue>

export const InteractState: ResourceDef<z.ZodType<InteractStateValue>> = defineResource(
  'interact.state',
  stateSchema,
  () => ({ hotspots: [], pending: null }),
)
