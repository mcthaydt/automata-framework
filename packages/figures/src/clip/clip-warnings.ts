// The clip compile warning (M3 spec §4.4.4, "keys in different spaces"): a channel whose space changes between
// neighbouring keys is interpolated in root space through the chest frame of whatever the layers below are
// doing, so the result depends on the torso underneath. A function, not a schema check: a key naming a pose by
// id needs the pose library, and the content compiler has no channel for a kind's warnings (a request for the
// content package). Importable for the Studio and for a game's content check (§4.4.6).

import type { FigureClipDef } from './clip.schema'
import { mixedChannels, type PoseLibrary } from './sample'

export interface ClipWarning {
  readonly path: readonly (string | number)[]
  readonly message: string
}

/** Each pair of neighbouring keys whose channel changes space, at the later key. A pose not found is skipped
 * (the content compile reports a missing pose as an error). */
export function clipWarnings(clip: FigureClipDef, poses: PoseLibrary): ClipWarning[] {
  const resolved = clip.keys.map((key) => (typeof key.pose === 'string' ? poses[key.pose] : key.pose))
  const warnings: ClipWarning[] = []
  for (let i = 1; i < resolved.length; i++) {
    const [a, b] = [resolved[i - 1], resolved[i]]
    if (!a || !b) continue
    const mixed = mixedChannels(a, b)
    const spaces = (x?: { space?: string | undefined }, y?: { space?: string | undefined }) =>
      `${x?.space ?? 'root'} space at key ${i - 1} and ${y?.space ?? 'root'} space at key ${i}`
    for (const id of mixed.effectors)
      warnings.push({
        path: ['keys', i],
        message: `${id} is in ${spaces(a.effectors[id], b.effectors[id])}; it is interpolated in root space through the chest frame below`,
      })
    for (const id of mixed.poles)
      warnings.push({
        path: ['keys', i],
        message: `${id} is in ${spaces(a.poles?.[id], b.poles?.[id])}; it is interpolated in root space through the chest frame below`,
      })
  }
  return warnings
}
