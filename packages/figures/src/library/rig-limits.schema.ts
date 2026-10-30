// Rig limits (M3 spec §4.4.2, content `rig.json` there, the `figure-rig` kind here): hinge ranges for the elbows
// and knees, swing cones for the shoulders and hips, and twist, yaw, pitch and roll ranges for the chest, neck
// and head, in degrees. M3.6a's solve() clamps to them; this task only checks that each range is a range.

import { z } from 'zod'
import { about } from './shapes.schema'

export interface Range {
  readonly min: number
  readonly max: number
}
export interface RigLimits {
  readonly about?: string | undefined
  readonly elbow: Range
  readonly knee: Range
  readonly shoulder: { readonly cone: number }
  readonly hip: { readonly cone: number }
  readonly chest: { readonly twist: Range; readonly pitch: Range }
  readonly neck: { readonly yaw: Range; readonly pitch: Range }
  readonly head: { readonly yaw: Range; readonly pitch: Range; readonly roll: Range }
}

const degrees = z.number().min(-180).max(180)
const range: z.ZodType<Range> = z
  .strictObject({ min: degrees, max: degrees })
  .refine((r) => r.min <= r.max, { message: 'min must not be more than max', path: ['min'] })
const cone = z.strictObject({ cone: z.number().min(0).max(180) })

export const rigLimitsSchema: z.ZodType<RigLimits> = z.strictObject({
  about,
  elbow: range,
  knee: range,
  shoulder: cone,
  hip: cone,
  chest: z.strictObject({ twist: range, pitch: range }),
  neck: z.strictObject({ yaw: range, pitch: range }),
  head: z.strictObject({ yaw: range, pitch: range, roll: range }),
})

/**
 * The shared default (M3 spec §4.4.2: "one shared default"): what a figure that names no `rig` gets, even in a
 * game with no figure-rig content. The fixture's `figure-rigs/default.toml` says the same (a test checks it).
 * The spec's starting values as M3.6a tuned them: the shoulder cone lets an arm point well above level, the hip
 * cone a deep seat or a climb, and the spec's head turn (yaw ±70°) is split over the neck and the head, so the
 * head turns at most 35 + 35 + 45 = 115° from the hips. Chest and neck roll are not limited.
 */
export const DEFAULT_RIG_LIMITS: RigLimits = Object.freeze({
  elbow: { min: 0, max: 150 },
  knee: { min: 0, max: 150 },
  shoulder: { cone: 170 },
  hip: { cone: 120 },
  chest: { twist: { min: -35, max: 35 }, pitch: { min: -20, max: 30 } },
  neck: { yaw: { min: -35, max: 35 }, pitch: { min: -20, max: 25 } },
  head: { yaw: { min: -45, max: 45 }, pitch: { min: -25, max: 30 }, roll: { min: -25, max: 25 } },
})
