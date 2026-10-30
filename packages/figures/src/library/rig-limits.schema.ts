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
