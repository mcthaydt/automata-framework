// The action content kind (schema `figure-action`): what a figure does, as the figure source's actors kept it: a
// wind-up (anticipation), the action and a recovery back to the gait, with keyed poses over the first two. An
// action is a clip with an envelope, not a second player: `compileAction` (clips/figure-action.ts) turns it into
// the clip `evaluate` plays. Its id is its file's name. The compile refuses keys out of order or past the end, a
// key naming a missing pose (a `contentRef`, so the compiler gives its file, line and column), and an inline
// pose failing the pose checks.

import { z } from 'zod'
import { easeSchema } from '../../../shared/timeline/ease.ts'
import { type ClipKey, MASK_GROUPS, type MaskGroup } from '../clips/clip.schema.ts'
import { type PoseDef, poseSchema } from '../motion/pose.schema.ts'
import { refOrInline } from './ref-or-inline.ts'
import { about } from './shapes.schema.ts'

/** An action (content kind `figure-action`). All times are seconds from the action's start. */
export interface FigureAction {
  readonly about?: string | undefined
  /** The body groups it owns while it plays; the gait keeps the rest. */
  readonly mask: readonly MaskGroup[]
  /** The wind-up: the body blends from where it is to the first key over this long (the first key is usually at it). */
  readonly anticipation: number
  /** The action itself, from the end of the wind-up. */
  readonly action: number
  /** After the action ends, the pose blends back to the gait over this long. */
  readonly recovery: number
  /** The blend in at the start, when it should be quicker than the wind-up (0 at once); else the wind-up, at least 0.08 s. */
  readonly enter?: number | undefined
  /** Held at its last key until the sim ends it, instead of ending when the action does (sit, kneel, fall). */
  readonly hold?: boolean | undefined
  /** Keyed poses in time order; the body as it stands is implied at 0. Each is eased into smoothly unless it names an ease. */
  readonly keys: readonly ClipKey[]
}

/** How long an action's wind-up and action take, in seconds, free of the sum's rounding (0.1 + 0.7 is 0.7999…). */
export const actionLength = (action: Pick<FigureAction, 'anticipation' | 'action'>): number =>
  Math.round((action.anticipation + action.action) * 1e9) / 1e9

const key = z.strictObject({
  t: z.number().min(0),
  pose: refOrInline<PoseDef>('figure-pose', { object: poseSchema }),
  ease: easeSchema.optional(),
})

export const figureActionSchema: z.ZodType<FigureAction> = z
  .strictObject({
    about,
    mask: z.array(z.enum(MASK_GROUPS)).min(1),
    anticipation: z.number().min(0),
    action: z.number().min(0),
    recovery: z.number().min(0),
    enter: z.number().min(0).optional(),
    hold: z.boolean().optional(),
    keys: z.array(key).min(1),
  })
  .superRefine((action, ctx) => {
    const issue = (path: (string | number)[], message: string): void => {
      ctx.addIssue({ code: 'custom', path, message })
    }
    const length = actionLength(action)
    if (!(length > 0)) issue(['action'], 'the wind-up and the action together must take some time')
    action.keys.forEach((k, i) => {
      const before = action.keys[i - 1]
      if (before && k.t <= before.t)
        issue(['keys', i, 't'], `key ${i} at ${k.t} s is not after key ${i - 1} at ${before.t} s`)
      else if (k.t > length)
        issue(['keys', i, 't'], `key ${i} at ${k.t} s is after the end of the action, ${length} s`)
    })
    action.mask.forEach((group, i) => {
      if (action.mask.indexOf(group) !== i) issue(['mask', i], `${group} is named twice`)
    })
  })
