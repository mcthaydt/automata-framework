import { beforeAll, describe, expect, it } from 'vitest'
import {
  apply,
  applyDir,
  dot,
  IDENTITY_Q,
  invertRigid,
  type M,
  matq,
  normalize,
  type Q,
  qconj,
  qmul,
  rotationOf,
  sub,
  type V3,
} from '../../../shared/math/math.ts'
import { fixtureLimits } from '../../../testing/fixture-limits.ts'
import { at3, KEEPER, NO_TARGETS, OPEN_LIMITS, WICK } from '../../../testing/solve-fixtures.ts'
import { at, fk, J, type Pose, restPose, type Skeleton } from '../body/rig.ts'
import type { RigLimits } from '../content/rig-limits.schema.ts'
import { angleBetween, degrees, eulerDegrees, eulerOf, radians } from './rotation.ts'
import { solve } from './solve.ts'
import type { AimTarget, Targets } from './targets.ts'

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
      // The heading bound (the yaw bounds summed) and the joints' own bounds meet here, so each joint ends on
      // its bound, to within the aim's convergence.
      expect(yawOf(J.spine)).toBeCloseTo(0.3 * bound(limits.chest.twist), 6)
      expect(yawOf(J.chest)).toBeCloseTo(0.7 * bound(limits.chest.twist), 6)
      expect(yawOf(J.neck)).toBeCloseTo(bound(limits.neck.yaw), 6)
      expect(yawOf(J.head)).toBeCloseTo(bound(limits.head.yaw), 6)
      expect(report.limited).toContain('head')
      expect(report.reached.aim?.ok).toBe(false)
      // The face's turn from the hips is the sum of the bounds: 115° with the default limits.
      const face = applyDir(invertRigid(at(world, J.pelvis)), forward(world, J.head))
      const turn = degrees(Math.atan2(face[0], face[2]))
      expect(Math.abs(turn)).toBeLessThan(115 + 1e-6)
      expect(Math.abs(turn)).toBeGreaterThan(115 - 1e-6)
    }
  })
  it('never turns the face past the yaw bounds summed (115°), even looking back and down or up', () => {
    // Per-joint limits alone do not bound the heading: yaw about a pitched chest, with roll, compounds.
    let worst = 0
    for (let yaw = 116; yaw <= 179; yaw += 7)
      for (let pitch = -60; pitch <= 80; pitch += 10)
        for (const side of [1, -1]) {
          const point = pointFromHead(WICK, restPose(), side * yaw, pitch, 3)
          const { world, report } = solve(WICK, restPose(), aimAt({ at: point, part: 'head' }), limits)
          const face = applyDir(invertRigid(at(world, J.pelvis)), forward(world, J.head))
          worst = Math.max(worst, Math.abs(degrees(Math.atan2(face[0], face[2]))))
          // Well past the bound (not where looking nearly straight down makes headings close), the aim misses
          // and says the head was held.
          if (yaw >= 123 && Math.abs(pitch) <= 60) {
            expect(report.reached.aim?.ok).toBe(false)
            expect(report.limited).toContain('head')
          }
        }
    expect(worst).toBeLessThan(115 + 1e-6)
  })
  it('spreads a small aim over spine, chest, neck and head by 0.1, 0.2, 0.3 and 0.4, about one axis', () => {
    // Each joint takes its share of one swing (in the pelvis's frame), so the turn each joint's world frame has
    // made is the running sum of the shares: 0.1, 0.3, 0.6 and 1.0 of the whole, all about the same axis.
    const base = stooped()
    const point = pointFromHead(WICK, base, 12, 6, 3)
    const { world } = solve(WICK, base, aimAt({ at: point, part: 'head' }), OPEN_LIMITS)
    const before = fk(WICK, base)
    const turnOf = (joint: number): Q =>
      qmul(matq(rotationOf(at(world, joint))), qconj(matq(rotationOf(at(before, joint)))))
    const whole = turnOf(J.head)
    const wholeAngle = angleBetween(IDENTITY_Q, whole)
    expect(wholeAngle).toBeGreaterThan(radians(5))
    const axis = normalize([whole[0], whole[1], whole[2]])
    for (const [joint, sum] of [
      [J.spine, 0.1],
      [J.chest, 0.3],
      [J.neck, 0.6],
      [J.head, 1],
    ] as const) {
      const turn = turnOf(joint)
      expect(angleBetween(IDENTITY_Q, turn)).toBeCloseTo(sum * wholeAngle, 9)
      const sign = turn[3] < 0 ? -1 : 1
      expect(dot(normalize([turn[0] * sign, turn[1] * sign, turn[2] * sign]), axis)).toBeCloseTo(1, 9)
    }
  })
  it('hits steep looks inside the limits (the floor at the feet, far down to the side)', () => {
    const keeper = fk(KEEPER, restPose())
    for (const x of [0.6, -0.6, 0.3, -0.3]) {
      const point = apply(at(keeper, J.root), [x, 0, 0.4])
      const { world, report } = solve(KEEPER, restPose(), aimAt({ at: point, part: 'head' }), limits)
      expect(angle(forward(world, J.head), sub(point, at3(world, J.head)))).toBeLessThan(0.5)
      expect(report.reached.aim?.ok).toBe(true)
    }
    for (const yaw of [20, -20]) {
      const point = pointFromHead(WICK, restPose(), yaw, 70, 3)
      const { report } = solve(WICK, restPose(), aimAt({ at: point, part: 'head' }), limits)
      expect(report.reached.aim?.ok).toBe(true)
    }
  })
  it('over a yaw and pitch sweep, misses only with an aim joint stopped on its bound', () => {
    let hits = 0
    for (let yaw = -110; yaw <= 110; yaw += 20)
      for (let pitch = -60; pitch <= 80; pitch += 10) {
        const point = pointFromHead(WICK, restPose(), yaw, pitch, 3)
        const { report } = solve(WICK, restPose(), aimAt({ at: point, part: 'head' }), limits)
        if (report.reached.aim?.ok) {
          hits++
          continue
        }
        // A joint the limits clamped on the aim's last step is stopped on its bound.
        const onBound = report.limited.some((joint) => ['spine', 'chest', 'neck', 'head'].includes(joint))
        expect({ yaw, pitch, onBound }).toEqual({ yaw, pitch, onBound: true })
      }
    expect(hits).toBeGreaterThan(80)
  })
  it('hits steep looks without limits, where a yaw-and-pitch split would break near straight down', () => {
    for (const [yaw, pitch] of [
      [90, 65],
      [110, 80],
      [-150, -70],
    ] as const) {
      const point = pointFromHead(WICK, restPose(), yaw, pitch, 3)
      const { report } = solve(WICK, restPose(), aimAt({ at: point, part: 'head' }), OPEN_LIMITS)
      expect(report.reached.aim?.ok).toBe(true)
    }
  })
  it('judges a weighted aim against its blended goal', () => {
    const base = stooped()
    for (const part of ['head', 'handR'] as const) {
      const point = pointFromHead(WICK, base, 40, 10, 3)
      const { report } = solve(WICK, base, aimAt({ at: point, part, weight: 0.5 }), limits)
      expect(report.reached.aim?.ok).toBe(true)
    }
  })
  it('solves a chest aim before a head aim, whatever their order', () => {
    const base = stooped()
    const chestPoint = pointFromHead(WICK, base, -20, 0, 3),
      headPoint = pointFromHead(WICK, base, 30, 10, 2)
    const a = solve(
      WICK,
      base,
      aimAt({ at: headPoint, part: 'head' }, { at: chestPoint, part: 'chest' }),
      limits,
    )
    const b = solve(
      WICK,
      base,
      aimAt({ at: chestPoint, part: 'chest' }, { at: headPoint, part: 'head' }),
      limits,
    )
    expect(a.pose).toEqual(b.pose)
    expect(angle(forward(a.world, J.head), sub(headPoint, at3(a.world, J.head)))).toBeLessThan(0.5)
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
    // The ignored head handle is not judged.
    expect(both.report.reached.head).toBeUndefined()
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
