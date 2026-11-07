// Clip layers: one clip sampled at its time, masked, with its blend
// ramp's weight, and merged over the layers below it. A layer is handles, not joint angles; `evaluate` solves the
// merged result once. The merge rule, the ramp and the additive mode are set here.

import { IDENTITY_Q, qmul } from '../../../shared/math/math.ts'
import type { Joint } from '../body/rig.ts'
import { blend } from '../motion/blend.ts'
import { CHEST_SHARES } from '../motion/limits.ts'
import type { PoseDef } from '../motion/pose.schema.ts'
import type { SpaceContext } from '../motion/pose-space.ts'
import { degrees, eulerDegrees, eulerOf, slerp } from '../motion/rotation.ts'
import type { EffectorId, Vec3 } from '../motion/targets.ts'
import { HEAD_SHARES } from '../motion/torso.ts'
import { blendKeyPoses, type PoseLibrary } from './blend-key-poses.ts'
import type { FigureClipDef, MaskGroup } from './clip.schema.ts'
import { smoothTime, stepTime } from './clip-time.ts'
import { maskPose } from './masks.ts'

/** One clip's contribution: its masked pose and its ramp weight in (0, 1]. */
export interface Layer {
  readonly pose: PoseDef
  readonly weight: number
  readonly mask: readonly MaskGroup[]
  readonly additive: boolean
}

/**
 * A clip's blend ramp at `elapsed` seconds of play: up over `blend.inMs` from the start, and down over
 * `blend.outMs` after `end` (seconds of play; a `once` clip's length, a stance's `endedAt`). No ramp is a cut: 1
 * from the start, 0 once past the end. 0 before the start.
 */
export function rampWeight(clip: FigureClipDef, elapsed: number, end?: number): number {
  if (elapsed < 0) return 0
  const inMs = clip.blend?.inMs ?? 0
  const outMs = clip.blend?.outMs ?? 0
  const rampIn = inMs > 0 ? Math.min(1, (elapsed * 1000) / inMs) : 1
  const after = end === undefined ? 0 : elapsed - end
  const rampOut = after <= 0 ? 1 : outMs > 0 ? Math.max(0, 1 - (after * 1000) / outMs) : 0
  return Math.min(rampIn, rampOut)
}

export interface ClipLayerOptions {
  readonly poses: PoseLibrary
  /** Pose steps a second: the clip's `rate`, else the gait's `poseRate`. */
  readonly rate: number
  /** Sample at the frame's own time instead of at the pose step. */
  readonly smooth?: boolean | undefined
  /** Seconds of play at the previous frame, so a marker passed since shows (`stepTime`, `smoothTime`). */
  readonly previous?: number | undefined
  /** Seconds of play at which the clip ends and starts to ramp out. */
  readonly end?: number | undefined
  /** The chest frame of the layers below, for keys in different spaces (`blendKeyPoses`). */
  readonly context?: SpaceContext | undefined
}

/** The clip's masked pose after `elapsed` seconds of play, at its pose step or (smooth) at the frame's time. */
export function clipPose(clip: FigureClipDef, elapsed: number, options: ClipLayerOptions): PoseDef {
  const t = options.smooth
    ? smoothTime(clip, elapsed, options.previous)
    : stepTime(clip, elapsed, options.rate, options.previous)
  return maskPose(blendKeyPoses(clip, t, options.poses, options.context), clip.mask)
}

/** The clip's layer after `elapsed` seconds of play, or undefined while its weight is 0. */
export function clipLayer(
  clip: FigureClipDef,
  elapsed: number,
  options: ClipLayerOptions,
): Layer | undefined {
  const weight = rampWeight(clip, elapsed, options.end)
  if (weight <= 0) return undefined
  return {
    pose: clipPose(clip, elapsed, options),
    weight,
    mask: clip.mask,
    additive: clip.mode === 'additive',
  }
}

/** The part of `pose` on the channels `names` names (its handles, poles, fk joints and root offset). */
function onChannelsOf(pose: PoseDef, names: PoseDef): PoseDef {
  const pick = <V>(from: Readonly<Partial<Record<string, V>>> | undefined, keys: object | undefined) =>
    Object.fromEntries(Object.keys(keys ?? {}).flatMap((key) => (from?.[key] ? [[key, from[key]]] : [])))
  return {
    effectors: pick(pose.effectors, names.effectors),
    poles: pick(pose.poles, names.poles),
    fk: pick(pose.fk, names.fk),
    ...(names.root && pose.root ? { root: pose.root } : {}),
  }
}

/** The part of `pose` off the channels `names` names. */
function offChannelsOf(pose: PoseDef, names: PoseDef): PoseDef {
  const drop = <V>(from: Readonly<Partial<Record<string, V>>> | undefined, keys: object | undefined) =>
    Object.fromEntries(Object.entries(from ?? {}).filter(([key]) => !(keys && key in keys)))
  return {
    effectors: drop(pose.effectors, names.effectors),
    poles: drop(pose.poles, names.poles),
    fk: drop(pose.fk, names.fk),
    ...(pose.root && !names.root ? { root: pose.root } : {}),
  }
}

/**
 * `layer` over `below`: on a channel both name, `blend` at the layer's weight; a channel only the layer names
 * comes in with its weight times the layer's (`blend`'s rule for a handle one pose leaves out); every other
 * channel of `below` is kept.
 */
export function mergeLayer(below: PoseDef, layer: Layer, context: SpaceContext = {}): PoseDef {
  const blended = blend(onChannelsOf(below, layer.pose), layer.pose, layer.weight, context)
  const kept = offChannelsOf(below, layer.pose)
  return {
    effectors: { ...kept.effectors, ...blended.effectors },
    poles: { ...kept.poles, ...blended.poles },
    fk: { ...kept.fk, ...blended.fk },
    ...((blended.root ?? kept.root) ? { root: blended.root ?? kept.root } : {}),
  }
}

/** How the solver shares a body handle's turn over its joints (torso.ts). */
const TURN_SHARES: Readonly<Partial<Record<EffectorId, readonly (readonly [Joint, number])[]>>> = {
  pelvis: [['pelvis', 1]],
  chest: [
    ['spine', CHEST_SHARES.spine],
    ['chest', CHEST_SHARES.chest],
  ],
  head: [
    ['neck', HEAD_SHARES.neck],
    ['head', HEAD_SHARES.head],
  ],
}

/**
 * An additive layer's turns composed onto `pose`'s fk joints at the layer's weight: its fk turns, and its pelvis,
 * chest and head turns shared over their joints as the solver shares them. Positions, limb handles and poles are
 * ignored (decision 9).
 */
export function addTurns(pose: PoseDef, layer: Layer): PoseDef {
  const turns: [Joint, Vec3][] = Object.entries(layer.pose.fk ?? {}) as [Joint, Vec3][]
  for (const [effector, shares] of Object.entries(TURN_SHARES) as [EffectorId, [Joint, number][]][]) {
    const rot = layer.pose.effectors[effector]?.rot
    if (rot)
      for (const [joint, share] of shares)
        turns.push([joint, [rot[0] * share, rot[1] * share, rot[2] * share]])
  }
  const fk: Partial<Record<Joint, Vec3>> = { ...pose.fk }
  for (const [joint, turn] of turns) {
    const added = slerp(IDENTITY_Q, eulerDegrees(turn), layer.weight)
    const composed = qmul(fk[joint] ? eulerDegrees(fk[joint]) : IDENTITY_Q, added)
    fk[joint] = eulerOf(composed).map(degrees) as unknown as Vec3
  }
  return { ...pose, fk }
}
