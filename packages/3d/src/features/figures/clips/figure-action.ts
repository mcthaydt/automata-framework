// An action as the clip the one player plays. The figure source's actors had a second player for actions (a
// weight envelope over keyed pose specs); here an action is data that compiles to a `FigureClipDef`, so
// `evaluate` stays the only player and an action masks, blends and replaces like any other clip.
//
// The envelope maps onto the clip: the clip is as long as the wind-up and the action; it blends in over the
// wind-up (or `enter`) and out over the recovery (`blend`); a held action's clip is `hold`; the body as it
// stands is the key at 0 when the first key is later, and the last pose is held to the end of the action.

import { actionLength, type FigureAction } from '../content/figure-action.schema.ts'
import type { PoseDef } from '../motion/pose.schema.ts'
import type { ClipKey, FigureClipDef } from './clip.schema.ts'

/** The body as it stands: sets no handle, so every channel is left to the layers below. */
export const NEUTRAL_POSE: PoseDef = Object.freeze({ effectors: {} })

/** A blend in no quicker than this unless the action asks for it (the figure source's floor for a wind-up). */
const MIN_ENTER = 0.08

/** The clip an action plays as. */
export function compileAction(action: FigureAction): FigureClipDef {
  const length = actionLength(action)
  const first = action.keys[0]
  const last = action.keys.at(-1)
  if (!first || !last) throw new RangeError('an action has no keys')
  const keys: ClipKey[] = []
  if (first.t > 0) keys.push({ t: 0, pose: NEUTRAL_POSE })
  for (const key of action.keys) keys.push({ ...key, ease: key.ease ?? 'smooth' })
  if (last.t < length) keys.push({ t: length, pose: last.pose })
  const enter = action.enter ?? Math.max(MIN_ENTER, action.anticipation)
  return {
    length,
    loop: action.hold ? 'hold' : 'once',
    mask: action.mask,
    blend: { inMs: enter * 1000, outMs: action.recovery * 1000 },
    keys,
  }
}

/**
 * The clips a figure can play: the authored `figure-clip`s and every `figure-action` compiled. An id is one or
 * the other; both is an error naming it, so a sim's `start` never plays the wrong one.
 */
export function clipsWithActions(
  clips: Readonly<Record<string, FigureClipDef>>,
  actions: Readonly<Record<string, FigureAction>>,
): Record<string, FigureClipDef> {
  const all: Record<string, FigureClipDef> = { ...clips }
  for (const [id, action] of Object.entries(actions)) {
    if (id in clips) throw new RangeError(`There is a figure-clip and a figure-action both called "${id}"`)
    all[id] = compileAction(action)
  }
  return all
}
