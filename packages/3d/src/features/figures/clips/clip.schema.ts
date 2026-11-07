// The clip content kind (M3 spec §4.4.4 `FigureClipDef`, schema `figure-clip`): a time-ordered list of keyed
// poses. Keys hold handles, not joint angles, so sampling interpolates targets and the solver runs on the
// result. Its id is its file's name. The compile refuses (§6): keys out of order, not starting at 0 or not
// ending at `length`, an unknown mask group, a marker or cue outside [0, length], a key naming a missing pose
// (a `contentRef`, so the compiler gives its file, line and column), and an inline pose failing the pose checks.

import { z } from 'zod'
import { refOrInline } from '../content/ref-or-inline.ts'
import { type PoseDef, poseSchema } from '../motion/pose.schema.ts'

/** How a key is eased into: CSS's named curves, a held step, or a CSS cubic-bezier(x1, y1, x2, y2). */
export type Ease = 'step' | 'linear' | 'in' | 'out' | 'inOut' | readonly [number, number, number, number]
export const MASK_GROUPS = ['root', 'pelvis', 'torso', 'head', 'armL', 'armR', 'legL', 'legR'] as const
export type MaskGroup = (typeof MASK_GROUPS)[number]

export interface ClipKey {
  /** Seconds from the clip's start. */
  readonly t: number
  /** A pose id, or a pose written inline. */
  readonly pose: string | PoseDef
  /** How the segment ending at this key is eased; linear when left out. */
  readonly ease?: Ease | undefined
}

/** A clip (content kind `figure-clip`): keyed poses over `length` seconds, the body groups it owns, markers and cues. */
export interface FigureClipDef {
  readonly length: number
  readonly loop: 'once' | 'loop' | 'pingpong' | 'hold'
  readonly mask: readonly MaskGroup[]
  readonly mode?: 'override' | 'additive' | undefined
  /** Pose steps a second; the figure's gait `poseRate` when left out. */
  readonly rate?: number | undefined
  readonly blend?: { readonly inMs: number; readonly outMs: number } | undefined
  readonly keys: readonly ClipKey[]
  readonly markers?: Readonly<Record<string, number>> | undefined
  readonly cues?: readonly { readonly t: number; readonly id: string }[] | undefined
}

const unit = z.number().min(0).max(1)
const ease = z.union([
  z.enum(['step', 'linear', 'in', 'out', 'inOut']),
  z.tuple([unit, z.number(), unit, z.number()]),
])
const key = z.strictObject({
  t: z.number().min(0),
  pose: refOrInline<PoseDef>('figure-pose', { object: poseSchema }),
  ease: ease.optional(),
})

export const clipSchema: z.ZodType<FigureClipDef> = z
  .strictObject({
    length: z.number().positive(),
    loop: z.enum(['once', 'loop', 'pingpong', 'hold']),
    mask: z.array(z.enum(MASK_GROUPS)).min(1),
    mode: z.enum(['override', 'additive']).optional(),
    rate: z.number().positive().optional(),
    blend: z.strictObject({ inMs: z.number().min(0), outMs: z.number().min(0) }).optional(),
    keys: z.array(key).min(2),
    markers: z.record(z.string().min(1), z.number()).optional(),
    cues: z.array(z.strictObject({ t: z.number(), id: z.string().min(1) })).optional(),
  })
  .superRefine((clip, ctx) => {
    const issue = (path: (string | number)[], message: string): void => {
      ctx.addIssue({ code: 'custom', path, message })
    }
    const { length, keys } = clip
    keys.forEach((k, i) => {
      const before = keys[i - 1]
      if (before && k.t <= before.t)
        issue(['keys', i, 't'], `key ${i} at ${k.t} s is not after key ${i - 1} at ${before.t} s`)
    })
    if (keys[0] && keys[0].t !== 0) issue(['keys', 0, 't'], `the first key must be at 0, not ${keys[0].t}`)
    const last = keys.at(-1)
    if (last && last.t !== length)
      issue(['keys', keys.length - 1, 't'], `the last key must be at the length, ${length}, not ${last.t}`)
    clip.mask.forEach((group, i) => {
      if (clip.mask.indexOf(group) !== i) issue(['mask', i], `${group} is named twice`)
    })
    const inside = (t: number): boolean => t >= 0 && t <= length
    for (const [name, t] of Object.entries(clip.markers ?? {}))
      if (!inside(t)) issue(['markers', name], `${name} at ${t} s is outside the clip (0 to ${length} s)`)
    clip.cues?.forEach((cue, i) => {
      if (!inside(cue.t))
        issue(['cues', i, 't'], `${cue.id} at ${cue.t} s is outside the clip (0 to ${length} s)`)
    })
  })
