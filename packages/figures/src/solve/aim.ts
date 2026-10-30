// Aim (M3 spec §4.4.2): a head or chest turns its forward axis (+z) toward a world point, spread over the torso
// by share and clamped by the limits; a hand aim points the arm straight at the point.
//
// The torso aim is solved by steps: measure the yaw and pitch still to go between the part's forward axis and
// the point, in the pelvis's frame; add them to the aim's running total; set each joint to its base turn times
// `euler(share · pitch, share · yaw, 0)` and clamp it. A joint at its limit leaves the rest of the turn to the
// others on the next step, so a point the joints can reach together is reached, and one past them all leaves
// each at its bound. Steps stop when the angle left is under 1e-9 rad, when it stops shrinking (every joint is
// at a bound) or after 16. Without limits the joints keep exact shares of one euler turn, so the spread reads
// back as the shares.

import {
  add,
  applyDir,
  cross,
  dot,
  euler,
  length,
  type M,
  normalize,
  type Q,
  qmul,
  rotationOf,
  scale,
  sub,
  transpose3,
  type V3,
} from '../math/math'
import { at, J, type Pose, type Skeleton } from '../rig/rig'
import { chainWorld } from './chain-world'
import { clampJoint, type JointLimit } from './limits'
import { slerp } from './rotation'
import type { AimTarget } from './targets'

/** The head aim's spread (spine, chest, neck, head) and the chest aim's (the posture split). */
const TORSO_AIMS = {
  head: {
    part: J.head,
    shares: [
      [J.spine, 0.1],
      [J.chest, 0.2],
      [J.neck, 0.3],
      [J.head, 0.4],
    ],
  },
  chest: {
    part: J.chest,
    shares: [
      [J.spine, 0.3],
      [J.chest, 0.7],
    ],
  },
} as const

const MAX_STEPS = 16
const DONE = 1e-9

const positionOf = (m: M): V3 => [m[9], m[10], m[11]]
const yawOf = (v: V3): number => Math.atan2(v[0], v[2])
/** Positive looks down, as the euler's positive pitch turns +z toward −y. */
const pitchOf = (v: V3): number => Math.atan2(-v[1], Math.hypot(v[0], v[2]))
/** `a` wrapped into (−π, π]. */
const wrap = (a: number): number => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))

/** The angle in radians between `joint`'s forward axis and the direction from it to `point`. */
export function aimError(world: readonly M[], joint: number, point: V3): number {
  const fwd = applyDir(at(world, joint), [0, 0, 1])
  const to = normalize(sub(point, positionOf(at(world, joint))))
  return Math.atan2(length(cross(fwd, to)), dot(fwd, to))
}

/** The yaw and pitch from `joint`'s forward axis to `point`, in the pelvis's frame. */
function stillToGo(world: readonly M[], joint: number, point: V3): { yaw: number; pitch: number } {
  const toPelvis = transpose3(rotationOf(at(world, J.pelvis)))
  const inPelvis = (v: V3): V3 => [
    toPelvis[0] * v[0] + toPelvis[1] * v[1] + toPelvis[2] * v[2],
    toPelvis[3] * v[0] + toPelvis[4] * v[1] + toPelvis[5] * v[2],
    toPelvis[6] * v[0] + toPelvis[7] * v[1] + toPelvis[8] * v[2],
  ]
  const fwd = inPelvis(applyDir(at(world, joint), [0, 0, 1]))
  const to = inPelvis(sub(point, positionOf(at(world, joint))))
  return { yaw: wrap(yawOf(to) - yawOf(fwd)), pitch: pitchOf(to) - pitchOf(fwd) }
}

/**
 * Turns the torso so the head's or the chest's forward axis points at `aim.at`. Writes `pose`; returns the
 * joints the limits clamped on the final step.
 */
export function aimTorso(
  s: Skeleton,
  pose: Pose,
  aim: AimTarget & { readonly part: 'head' | 'chest' },
  table: ReadonlyMap<number, JointLimit>,
): number[] {
  const { part, shares } = TORSO_AIMS[aim.part]
  const point: V3 = [...aim.at]
  const start = shares.map(([joint]): Q => [...at(pose.rot, joint)])
  let world = chainWorld(s, pose, part)
  let left = aimError(world, part, point)
  let yaw = 0,
    pitch = 0
  let clamped: number[] = []
  for (let step = 0; step < MAX_STEPS && left > DONE; step++) {
    const go = stillToGo(world, part, point)
    yaw += go.yaw
    pitch += go.pitch
    const tried: Q[] = []
    const stepClamped: number[] = []
    for (const [i, [joint, share]] of shares.entries()) {
      const turn = qmul(at(start, i), euler(share * pitch, share * yaw, 0))
      const limited = clampJoint(turn, table.get(joint))
      if (limited) stepClamped.push(joint)
      tried.push(limited ?? turn)
    }
    const before = shares.map(([joint]) => at(pose.rot, joint))
    for (const [i, [joint]] of shares.entries()) pose.rot[joint] = at(tried, i)
    const next = chainWorld(s, pose, part)
    const nextLeft = aimError(next, part, point)
    if (nextLeft >= left) {
      // No closer: every joint is at a bound (or the step overshot). Keep the better pose.
      for (const [i, [joint]] of shares.entries()) pose.rot[joint] = at(before, i)
      break
    }
    world = next
    left = nextLeft
    clamped = stepClamped
  }
  const weight = aim.weight ?? 1
  if (weight < 1)
    for (const [i, [joint]] of shares.entries())
      pose.rot[joint] = slerp(at(start, i), at(pose.rot, joint), weight)
  return clamped
}

/** A hand aim's target: the hand at full reach on the ray from the shoulder through the point. */
export function handAimTarget(world: readonly M[], shoulder: number, reach: number, point: V3): V3 {
  const from = positionOf(at(world, shoulder))
  return add(from, scale(normalize(sub(point, from)), reach))
}

/** The angle in radians between the arm (shoulder to hand) and the shoulder-to-point direction. */
export function handAimError(world: readonly M[], shoulder: number, hand: number, point: V3): number {
  const from = positionOf(at(world, shoulder))
  const arm = normalize(sub(positionOf(at(world, hand)), from)),
    to = normalize(sub(point, from))
  return Math.atan2(length(cross(arm, to)), dot(arm, to))
}
