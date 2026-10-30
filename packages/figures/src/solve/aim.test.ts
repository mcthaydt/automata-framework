import { beforeAll, describe, expect, it } from 'vitest'
import type { RigLimits } from '../library/rig-limits.schema'
import { apply, applyDir, dot, invertRigid, type M, normalize, qconj, qmul, sub, type V3 } from '../math/math'
import { at, fk, J, type Pose, restPose, type Skeleton } from '../rig/rig'
import { fixtureLimits } from '../testing/fixture-limits'
import { at3, KEEPER, NO_TARGETS, OPEN_LIMITS, WICK } from '../testing/solve-fixtures'
import { degrees, eulerDegrees, eulerOf, radians } from './rotation'
import { solve } from './solve'
import type { AimTarget, Targets } from './targets'

let limits: RigLimits
beforeAll(async () => {
  limits = await fixtureLimits()
})

const aimAt = (...aim: AimTarget[]): Targets => ({ ...NO_TARGETS, aim })
/** The angle in degrees between two directions. */
const angle = (a: V3, b: V3): number =>
  degrees(Math.acos(Math.max(-1, Math.min(1, dot(normalize(a), normalize(b))))))
/** A joint's forward axis (+z) in the world. */
const forward = (world: readonly M[], joint: number): V3 => applyDir(at(world, joint), [0, 0, 1])

/** A standing base with a stoop and a turned root, as locomotion would leave it. */
function stooped(): Pose {
  const base = restPose()
  base.root = [0.5, 0, -2]
  base.yaw = 0.6
  base.rot[J.spine] = eulerDegrees([3, 0, 0])
  base.rot[J.chest] = eulerDegrees([7, 0, 0])
  return base
}

/** A world point `distance` from the head, `yaw` and `pitch` degrees off the pelvis's forward (pitch down). */
function pointFromHead(s: Skeleton, base: Pose, yaw: number, pitch: number, distance: number): V3 {
  const world = fk(s, base)
  const pelvis = at(world, J.pelvis)
  const y = radians(yaw),
    p = radians(pitch)
  const dir = applyDir(pelvis, [Math.sin(y) * Math.cos(p), -Math.sin(p), Math.cos(y) * Math.cos(p)])
  const head = at3(world, J.head)
  return [head[0] + dir[0] * distance, head[1] + dir[1] * distance, head[2] + dir[2] * distance]
}

describe('I-e: a head aim', () => {
  it('turns the head onto a point inside the limits within 0.5°, both figures, a stooped and turned base', () => {
    for (const s of [WICK, KEEPER]) {
      const base = stooped()
      for (const [yaw, pitch, distance] of [
        [0, 0, 3],
        [40, 10, 2],
        [-60, -15, 4],
        [90, 20, 1.5],
        [-100, 5, 5],
        [20, 40, 2],
      ] as const) {
        const point = pointFromHead(s, base, yaw, pitch, distance)
        const { world, report } = solve(s, base, aimAt({ at: point, part: 'head' }), limits)
        expect(angle(forward(world, J.head), sub(point, at3(world, J.head)))).toBeLessThan(0.5)
        expect(report.reached.aim?.ok).toBe(true)
        expect(report.limited).toEqual([])
      }
    }
  })
  it('stops every joint at its limit for a point behind, and the face never turns past them', () => {
    for (const [yaw, sign] of [
      [150, 1],
      [-170, -1],
      [120, 1],
    ] as const) {
      const base = restPose()
      const point = pointFromHead(WICK, base, yaw, 0, 3)
      const { pose, world, report } = solve(WICK, base, aimAt({ at: point, part: 'head' }), limits)
      const yawOf = (joint: number): number => degrees(eulerOf(at(pose.rot, joint))[1])
      const bound = (r: { min: number; max: number }): number => (sign > 0 ? r.max : r.min)
      expect(yawOf(J.spine)).toBeCloseTo(0.3 * bound(limits.chest.twist), 9)
      expect(yawOf(J.chest)).toBeCloseTo(0.7 * bound(limits.chest.twist), 9)
      expect(yawOf(J.neck)).toBeCloseTo(bound(limits.neck.yaw), 9)
      expect(yawOf(J.head)).toBeCloseTo(bound(limits.head.yaw), 9)
      expect(report.limited).toEqual(['spine', 'chest', 'neck', 'head'])
      expect(report.reached.aim?.ok).toBe(false)
      // The face's turn from the hips is the sum of the bounds: 115° with the default limits.
      const face = applyDir(invertRigid(at(world, J.pelvis)), forward(world, J.head))
      const turn = degrees(Math.atan2(face[0], face[2]))
      expect(Math.abs(turn)).toBeLessThan(115 + 1e-6)
      expect(Math.abs(turn)).toBeGreaterThan(115 - 1e-6)
    }
  })
  it('spreads a small aim over spine, chest, neck and head by 0.1, 0.2, 0.3 and 0.4', () => {
    const base = stooped()
    const point = pointFromHead(WICK, base, 12, 6, 3)
    const { pose } = solve(WICK, base, aimAt({ at: point, part: 'head' }), OPEN_LIMITS)
    const turns = [
      [J.spine, 0.1],
      [J.chest, 0.2],
      [J.neck, 0.3],
      [J.head, 0.4],
    ].map(([joint, share]) => {
      const [p, y, r] = eulerOf(qmul(qconj(at(base.rot, joint as number)), at(pose.rot, joint as number)))
      return { p: p / (share as number), y: y / (share as number), r }
    })
    const first = turns[0] as { p: number; y: number }
    expect(Math.abs(first.y)).toBeGreaterThan(radians(5))
    for (const t of turns) {
      expect(t.p).toBeCloseTo(first.p, 9)
      expect(t.y).toBeCloseTo(first.y, 9)
      expect(t.r).toBeCloseTo(0, 12)
    }
  })
  it('replaces a head rotation, and a weight of 0 leaves the base', () => {
    const base = stooped()
    const point = pointFromHead(WICK, base, 30, 0, 3)
    const both = solve(
      WICK,
      base,
      { ...aimAt({ at: point, part: 'head' }), effectors: { head: { rot: [0, -40, 0] } } },
      limits,
    )
    expect(angle(forward(both.world, J.head), sub(point, at3(both.world, J.head)))).toBeLessThan(0.5)
    const none = solve(WICK, base, aimAt({ at: point, part: 'head', weight: 0 }), limits)
    expect(none.pose.rot).toEqual(base.rot)
  })
})

describe('chest and hand aims', () => {
  it('turns the chest onto a point with the spine and chest only', () => {
    const base = stooped()
    const point = pointFromHead(WICK, base, 25, 3, 3)
    const { pose, world, report } = solve(WICK, base, aimAt({ at: point, part: 'chest' }), limits)
    expect(angle(forward(world, J.chest), sub(point, at3(world, J.chest)))).toBeLessThan(0.5)
    expect(pose.rot[J.neck]).toEqual(base.rot[J.neck])
    expect(pose.rot[J.head]).toEqual(base.rot[J.head])
    expect(report.reached.aim?.ok).toBe(true)
  })
  it('points the arm and the hand at a point, as a drawn bow or a hookshot', () => {
    for (const s of [WICK, KEEPER]) {
      const base = stooped()
      const world0 = fk(s, base)
      const shoulder = at3(world0, J['upperArm.R'])
      const point = apply(at(world0, J.root), [shoulder[0] - 1, shoulder[1] + 1.5, 4])
      const { world, report } = solve(s, base, aimAt({ at: point, part: 'handR' }), limits)
      const root = at3(world, J['upperArm.R']),
        hand = at3(world, J['hand.R'])
      expect(angle(sub(hand, root), sub(point, root))).toBeLessThan(0.5)
      const fingers = applyDir(at(world, J['hand.R']), [0, -1, 0])
      expect(angle(fingers, sub(point, root))).toBeLessThan(0.5)
      expect(report.reached.aim?.ok).toBe(true)
      expect(report.limited).toEqual([])
    }
  })
})
