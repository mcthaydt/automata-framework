// The clip compile warnings (M3 spec §4.4.4): things that compile but may not play as the author meant.
// - A channel whose space changes between neighbouring keys is interpolated in root space through the chest
//   frame of whatever the layers below are doing, so the result depends on the torso underneath.
// - A handle both neighbouring keys name with different fields (a `rot` at one only): one weight covers all of
//   a handle's fields, so the lone field is held through the segment and drops to the layers below at the key
//   that lacks it (M3.6b `blend`).
// A function, not a schema check: a key naming a pose by id needs the pose library, and the content compiler has
// no channel for a kind's warnings (a request for the content package). Importable for the Studio and for a
// game's content check (§4.4.6).

import type { PoseDef } from '../pose/pose.schema'
import { mixedChannels } from '../pose/pose-space'
import { EFFECTOR_IDS } from '../pose/pose-spelling'
import type { FigureClipDef } from './clip.schema'
import type { PoseLibrary } from './sample'

export interface ClipWarning {
  readonly path: readonly (string | number)[]
  readonly message: string
}

const BELOW = 'it is interpolated in root space through the chest frame below'
const FIELDS = ['pos', 'rot'] as const

/** How a channel's space reads at key `i`: its own, or its limb's default for a pole the key leaves out. */
const where = (target: { space?: string | undefined } | undefined, i: number, isPole: boolean): string =>
  target === undefined && isPole
    ? `left to its default (root space) at key ${i}`
    : `in ${target?.space ?? 'root'} space at key ${i}`

const fieldsOf = (target: object): string[] => FIELDS.filter((field) => field in target)
const spell = (fields: readonly string[]): string => fields.join(' and ') || 'nothing'

/** The warnings for the pair of keys `i − 1` and `i`. */
function pairWarnings(a: PoseDef, b: PoseDef, i: number): ClipWarning[] {
  const warnings: ClipWarning[] = []
  const add = (message: string): void => {
    warnings.push({ path: ['keys', i], message })
  }
  const mixed = mixedChannels(a, b)
  for (const id of mixed.effectors)
    add(`${id} is ${where(a.effectors[id], i - 1, false)} and ${where(b.effectors[id], i, false)}; ${BELOW}`)
  for (const id of mixed.poles)
    add(`${id} is ${where(a.poles?.[id], i - 1, true)} and ${where(b.poles?.[id], i, true)}; ${BELOW}`)
  for (const id of EFFECTOR_IDS) {
    const [x, y] = [a.effectors[id], b.effectors[id]]
    if (!x || !y) continue
    const [fx, fy] = [fieldsOf(x), fieldsOf(y)]
    const lone = FIELDS.filter((field) => fx.includes(field) !== fy.includes(field))
    if (lone.length > 0)
      add(
        `${id} sets ${spell(fx)} at key ${i - 1} but ${spell(fy)} at key ${i}: ${spell(lone)} is held, then drops to the layers below at the key without it`,
      )
  }
  return warnings
}

/** The clip's warnings, each at the later key of its pair. A pose not found is skipped (the content compile
 * reports a missing pose as an error). */
export function clipWarnings(clip: FigureClipDef, poses: PoseLibrary): ClipWarning[] {
  const resolved = clip.keys.map((key) => (typeof key.pose === 'string' ? poses[key.pose] : key.pose))
  const warnings: ClipWarning[] = []
  for (let i = 1; i < resolved.length; i++) {
    const [a, b] = [resolved[i - 1], resolved[i]]
    if (a && b) warnings.push(...pairWarnings(a, b, i))
  }
  return warnings
}
