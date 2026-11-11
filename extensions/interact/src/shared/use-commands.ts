// What a tap on a hotspot sends: the walk to it and the use of it, in the one tick.
import type { Hotspot } from './sim/hotspot.schema'

/** The payloads of `nav.walk-to` and `interact.use` for a tap on `hotspot`, by the walker `entity`, with `held` in hand. */
export function useCommands(
  entity: number,
  hotspot: Hotspot,
  held?: string,
): readonly [walk: { entity: number; to: { x: number; z: number } }, use: { at: string; held?: string }] {
  return [
    { entity, to: { x: hotspot.x, z: hotspot.z } },
    held === undefined ? { at: hotspot.id } : { at: hotspot.id, held },
  ]
}
