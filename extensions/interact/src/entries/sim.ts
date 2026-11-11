// @automata/interact/sim: using a hotspot, a sim entry. The level's hotspots, the commands and events, and the plugin.
export { type Hotspot, hotspotSchema } from '../shared/sim/hotspot.schema'
export { type HotspotsRead, hotspotsOf } from '../shared/sim/hotspots-of'
export {
  Cancel,
  Combine,
  type CombinePayload,
  EnterCode,
  type EnterCodePayload,
  Use,
  type UsePayload,
} from '../shared/sim/interact.command'
export {
  InteractPending,
  type InteractPendingPayload,
  InteractRefused,
  type InteractRefusedPayload,
  InteractUsed,
  type InteractUsedPayload,
  type RefusedReason,
} from '../shared/sim/interact.event'
export { createInteract, type Interact } from '../shared/sim/interact.plugin'
export { InteractState } from '../shared/sim/interact.resource'
export type { InteractOptions, SimView } from '../shared/sim/interact-options'
export type { Pending } from '../shared/sim/pending'
