// Aim (M3 spec §4.4.2): a head or chest turns its forward axis (+z) toward a world point, spread over the torso
// by share and clamped by the limits; a hand aim points the arm straight at the point.
//
// The torso aim is one swing, `A`, in the pelvis's frame (an axis and an angle, so looking straight down is no
// different from looking aside). Each joint takes its share of it (`A` to the power of the share, about the same
// axis), carried into the joint's own frame through its parent's turn when the aim began, so the shares
// compose: the aimed part turns by exactly `A`, and each joint by the running sum of the shares before it.
// Then each joint is clamped. The swing is found by steps: measure the shortest swing from the part's forward
// axis to the point, add it to `A`, apply, and keep it if the angle left shrank. A step that does not help (it
// overshot past a clamp, or the head moved off the line) is retried at half the size, down to 1/256. Once some
// joints are clamped the others move only by their shares, so a step is the swing left divided by the shares
// still free (the head and neck clamped: the spine and chest's 0.3 take 1/0.3 of it); the steps
// stop when the angle left is under 1e-9 rad, when even the smallest step cannot help (the joints that matter
// are on their bounds) or after 40.

import {
  add,
  applyDir,
  axisAngle,
  compose,
  cross,
  dot,
  IDENTITY_Q,
  length,
  type M,
  matq,
  normalize,
  type Q,
  qconj,
  qmul,
  rotationOf,
  scale,
  sub,
  type V3,
} from '../math/math'
import { at, J, PARENTS, type Pose, type Skeleton } from '../rig/rig'
import { chainWorld } from './chain-world'
import { clampJoint, type JointLimit } from './limits'
import { radians, slerp } from './rotation'
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

const MAX_STEPS = 40
const DONE = 1e-9
/** The smallest fraction of a step tried before giving up. */
const SMALLEST_STEP = 1 / 256

const positionOf = (m: M): V3 => [m[9], m[10], m[11]]

/** The angle in radians between `joint`'s forward axis and the direction from it to `point`. */
export function aimError(world: readonly M[], joint: number, point: V3): number {
  const fwd = applyDir(at(world, joint), [0, 0, 1])
  const to = normalize(sub(point, positionOf(at(world, joint))))
  return Math.atan2(length(cross(fwd, to)), dot(fwd, to))
}

/** `fraction` of the shortest turn taking direction `from` to direction `to` (both unit). Opposite directions
 * have no shortest turn; they turn about `fallback`. */
function arc(from: V3, to: V3, fraction: number, fallback: V3): Q {
  const axis = cross(from, to)
  const angle = Math.atan2(length(axis), dot(from, to))
  if (angle < 1e-15) return [...IDENTITY_Q]
  return axisAngle(length(axis) < 1e-12 ? fallback : axis, angle * fraction)
}

/** `q` to the power `k`: the same axis, k times the angle (the shorter way round). */
function power(q: Q, k: number): Q {
  const sign = q[3] < 0 ? -1 : 1
  const v: V3 = [q[0] * sign, q[1] * sign, q[2] * sign]
  const sin = length(v)
  if (sin < 1e-15) return [...IDENTITY_Q]
  return axisAngle(v, 2 * Math.atan2(sin, q[3] * sign) * k)
}

/** A direction's heading (its yaw) in the pelvis's frame. */
const headingOf = (v: V3): number => Math.atan2(v[0], v[2])
const rotate = (q: Q, v: V3): V3 => applyDir(compose(q, [0, 0, 0]), v)

/** Where the torso aim began: what the report judges a weighted aim against. */
export interface TorsoAimed {
  /** Joints the limits clamped on the aim's last step. */
  readonly clamped: number[]
  /** The aimed part's forward axis (world) before the aim. */
  readonly from: V3
}

/**
 * Turns the torso so the head's or the chest's forward axis points at `aim.at`, then blends by the aim's weight
 * from where it began. Writes `pose`.
 */
export function aimTorso(
  s: Skeleton,
  pose: Pose,
  aim: AimTarget & { readonly part: 'head' | 'chest' },
  table: ReadonlyMap<number, JointLimit>,
): TorsoAimed {
  const { part, shares } = TORSO_AIMS[aim.part]
  const point: V3 = [...aim.at]
  const start = shares.map(([joint]): Q => [...at(pose.rot, joint)])
  let world = chainWorld(s, pose, part)
  const pelvis = matq(rotationOf(at(world, J.pelvis)))
  const toPelvis = qconj(pelvis)
  // Each joint's parent's turn in the pelvis's frame when the aim began: a share of A, a turn in the pelvis's
  // frame, becomes the joint's local turn G⁻¹ · D · G.
  const parentTurn = shares.map(([joint]) => qmul(toPelvis, matq(rotationOf(at(world, at(PARENTS, joint))))))
  const from = applyDir(at(world, part), [0, 0, 1])
  const tryTurn = (swing: Q): number[] => {
    const clamped: number[] = []
    for (const [i, [joint, share]] of shares.entries()) {
      const g = at(parentTurn, i)
      const turn = qmul(qmul(qmul(qconj(g), power(swing, share)), g), at(start, i))
      const limited = clampJoint(turn, table.get(joint))
      if (limited) clamped.push(joint)
      pose.rot[joint] = limited ?? turn
    }
    return clamped
  }
  // The face's heading (its yaw in the pelvis's frame) stays inside the aim joints' yaw bounds summed (115° for
  // the head with the default limits): per-joint limits alone do not bound it, since a yaw about a pitched
  // chest, with roll, compounds. A point past it is aimed at as if it sat on the bound.
  const heading = headingBounds(shares, table)
  let headingHeld = false
  const goal = (w: readonly M[]): { dir: V3; held: boolean } => {
    const to = normalize(rotate(toPelvis, sub(point, positionOf(at(w, part)))))
    const h = headingOf(to)
    const bounded = Math.min(heading.max, Math.max(heading.min, h))
    if (bounded === h) return { dir: to, held: false }
    return { dir: rotate(axisAngle([0, 1, 0], bounded - h), to), held: true }
  }
  const forwardOf = (w: readonly M[]): V3 => rotate(toPelvis, applyDir(at(w, part), [0, 0, 1]))
  const angleLeft = (w: readonly M[]): number => {
    const fwd = forwardOf(w),
      dir = goal(w).dir
    return Math.atan2(length(cross(fwd, dir)), dot(fwd, dir))
  }
  let swing: Q = [...IDENTITY_Q]
  let left = angleLeft(world)
  let clamped: number[] = []
  let fraction = 1
  let free = 1
  for (let step = 0; step < MAX_STEPS && left > DONE && fraction >= SMALLEST_STEP; step++) {
    const next = qmul(arc(forwardOf(world), goal(world).dir, fraction / free, [0, 1, 0]), swing)
    const before = shares.map(([joint]) => at(pose.rot, joint))
    const nextClamped = tryTurn(next)
    const nextWorld = chainWorld(s, pose, part)
    const nextLeft = angleLeft(nextWorld)
    // A step that takes the face further past the heading bound is refused like one that does not help (a base
    // already past it may only come back).
    const past = (w: readonly M[]): number => {
      const h = headingOf(forwardOf(w))
      return Math.max(0, h - heading.max, heading.min - h)
    }
    if (nextLeft < left && past(nextWorld) <= past(world) + 1e-12) {
      swing = next
      world = nextWorld
      left = nextLeft
      clamped = nextClamped
      free = Math.max(
        0.1,
        shares.reduce((sum, [joint, share]) => (clamped.includes(joint) ? sum : sum + share), 0),
      )
      fraction = 1
    } else {
      for (const [i, [joint]] of shares.entries()) pose.rot[joint] = at(before, i)
      fraction /= 2
    }
  }
  headingHeld = goal(world).held
  // The aimed part is listed as limited when the heading bound held it.
  if (headingHeld && !clamped.includes(part)) clamped.push(part)
  const weight = aim.weight ?? 1
  if (weight < 1)
    for (const [i, [joint]] of shares.entries())
      pose.rot[joint] = slerp(at(start, i), at(pose.rot, joint), weight)
  return { clamped, from }
}

/** The sum of the aim joints' yaw bounds, in radians (unbounded where a joint has no yaw limit). */
function headingBounds(
  shares: readonly (readonly [number, number])[],
  table: ReadonlyMap<number, JointLimit>,
): { min: number; max: number } {
  let min = 0,
    max = 0
  for (const [joint] of shares) {
    const limit = table.get(joint)
    const yaw = limit?.kind === 'euler' ? limit.yaw : undefined
    min += yaw ? radians(yaw.min) : -Infinity
    max += yaw ? radians(yaw.max) : Infinity
  }
  return { min, max }
}

/** The direction `weight` of the way round from `from` to `to` (both unit). */
export function blendDirection(from: V3, to: V3, weight: number): V3 {
  return rotate(arc(from, to, weight, [0, 1, 0]), from)
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
