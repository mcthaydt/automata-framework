import { describe, expect, it } from 'vitest'
import { at, fk, J, restPose } from '#src/features/figures/body/rig.ts'
import { LIMBS } from '#src/features/figures/motion/limbs.ts'
import { hingeFlexion } from '#src/features/figures/motion/limits.ts'
import { solve } from '#src/features/figures/motion/solve.ts'
import type { LimbId, Targets, Vec3 } from '#src/features/figures/motion/targets.ts'
import {
  add,
  applyDir,
  cross,
  dot,
  invertRigid,
  apply as move,
  normalize,
  scale,
  sub,
  type V3,
} from '#src/shared/math/math.ts'
import {
  at3,
  direction,
  distance,
  KEEPER,
  NO_TARGETS,
  OPEN_LIMITS,
  unit,
  WICK,
} from '#src/testing/solve-fixtures.ts'

const LIMB_IDS: readonly LimbId[] = ['footL', 'footR', 'handL', 'handR']
const targets = (extra: Partial<Targets>): Targets => ({ ...NO_TARGETS, ...extra })

describe('I-a: limb effectors reach, extend toward or survive any target', () => {
  it('puts every foot and hand within 1e-6 figure units of a reachable target in root space, both figures', () => {
    let seed = 0
    for (const s of [WICK, KEEPER]) {
      const k = unit(s)
      const base = restPose()
      base.root = [0.3, 0, -1.2]
      base.yaw = 0.7
      const world = fk(s, base)
      const toRoot = invertRigid(at(world, J.root))
      for (const limb of LIMB_IDS) {
        const [a, b, c] = LIMBS[limb].chain
        const reach = (distance(at(s.rest, a), at(s.rest, b)) + distance(at(s.rest, b), at(s.rest, c))) / k
        for (let i = 0; i < 12; i++) {
          seed++
          const fraction = 0.3 + 0.68 * ((seed * 0.618) % 1)
          // The limb's root in figure units, then a point a fraction of the reach from it.
          const rootFigure = scale(move(toRoot, at3(world, a)), 1 / k)
          const pos = add(rootFigure, scale(direction(seed), reach * fraction))
          const { world: solved, report } = solve(
            s,
            base,
            targets({ effectors: { [limb]: { pos } } }),
            OPEN_LIMITS,
          )
          const wanted = move(at(world, J.root), scale(pos, k))
          expect(distance(at3(solved, c), wanted) / k).toBeLessThan(1e-6)
          expect(report.reached[limb]?.ok).toBe(true)
          expect(report.reached[limb]?.error).toBeLessThan(1e-6)
        }
      }
    }
  })
  it('reads a hand target in chest space from the chest joint', () => {
    const base = restPose()
    base.rot[J.chest] = [Math.sin(0.15), 0, 0, Math.cos(0.15)]
    const pos: Vec3 = [0.05, -0.15, 0.25]
    const { world } = solve(
      WICK,
      base,
      targets({ effectors: { handR: { pos, space: 'chest' } } }),
      OPEN_LIMITS,
    )
    const wanted = move(at(world, J.chest), scale([...pos], unit(WICK)))
    expect(distance(at3(world, J['hand.R']), wanted)).toBeLessThan(1e-9)
  })
  it('extends a limb fully toward a target out of reach and reports the shortfall', () => {
    for (const limb of LIMB_IDS) {
      const [a, b, c] = LIMBS[limb].chain
      const k = unit(WICK)
      const length =
        distance(at(WICK.rest, a), at(WICK.rest, b)) + distance(at(WICK.rest, b), at(WICK.rest, c))
      const pos: Vec3 = [1.5, 2, 1]
      const { world, report } = solve(
        WICK,
        restPose(),
        targets({ effectors: { [limb]: { pos } } }),
        OPEN_LIMITS,
      )
      const root = at3(world, a),
        end = at3(world, c),
        wanted = scale([...pos], k)
      expect(distance(end, root)).toBeGreaterThan(length - 1e-5)
      expect(distance(end, root)).toBeLessThanOrEqual(length)
      const along = normalize(sub(end, root)),
        toward = normalize(sub(wanted, root))
      expect(Math.acos(Math.min(1, dot(along, toward)))).toBeLessThan(1e-6)
      expect(report.reached[limb]?.ok).toBe(false)
      expect(report.reached[limb]?.error).toBeCloseTo((distance(wanted, root) - length) / k, 5)
    }
  })
  it('gives finite joints for a pole parallel to the limb and for a target on the limb root', () => {
    const k = unit(WICK)
    const shoulder = scale(at(WICK.rest, J['upperArm.L']), 1 / k)
    const hip = scale(at(WICK.rest, J['thigh.R']), 1 / k)
    for (const t of [
      targets({
        effectors: { handL: { pos: sub(shoulder, [0, 0.3, 0]) } },
        poles: { elbowL: { dir: [0, -1, 0] } },
      }),
      targets({ effectors: { handL: { pos: shoulder }, footR: { pos: hip } } }),
    ]) {
      const { pose, world } = solve(WICK, restPose(), t, OPEN_LIMITS)
      for (const q of pose.rot) for (const v of q) expect(Number.isFinite(v)).toBe(true)
      for (const m of world) for (const v of m) expect(Number.isFinite(v)).toBe(true)
    }
  })
})

/** The middle joint's offset from the line between the limb's root and its end: the bend plane's direction. */
function bendDirection(world: ReturnType<typeof fk>, limb: LimbId): V3 {
  const [a, b, c] = LIMBS[limb].chain
  const root = at3(world, a),
    axis = normalize(sub(at3(world, c), root)),
    off = sub(at3(world, b), root)
  return normalize(sub(off, scale(axis, dot(off, axis))))
}

describe('I-b: a pole turns the bend plane, not the end', () => {
  it('swings the knee and elbow 90° when the pole turns 90° about the limb, the end moving less than 1e-6', () => {
    const k = unit(WICK)
    for (const [limb, pole] of [
      ['footL', 'kneeL'],
      ['handR', 'elbowR'],
    ] as const) {
      const [a] = LIMBS[limb].chain
      const root = scale(at(WICK.rest, a), 1 / k)
      // Straight below the limb's root, so the limb's axis is −y and turning the pole about y turns it about the limb.
      const pos: Vec3 = [root[0], root[1] - (limb === 'footL' ? 0.35 : 0.3), root[2]]
      const solveWith = (dir: Vec3): ReturnType<typeof solve> =>
        solve(
          WICK,
          restPose(),
          targets({ effectors: { [limb]: { pos } }, poles: { [pole]: { dir } } }),
          OPEN_LIMITS,
        )
      const before = solveWith([0, 0, 1]),
        after = solveWith([1, 0, 0])
      const turn = Math.acos(dot(bendDirection(before.world, limb), bendDirection(after.world, limb)))
      expect(Math.abs(turn - Math.PI / 2)).toBeLessThan(1e-9)
      const [, , c] = LIMBS[limb].chain
      expect(distance(at3(before.world, c), at3(after.world, c))).toBeLessThan(1e-6)
    }
  })
  it('turns the bend plane 90° for a tilted limb and a pole not square to it', () => {
    const k = unit(WICK)
    const [a, , c] = LIMBS.handL.chain
    const shoulder = scale(at(WICK.rest, a), 1 / k)
    const pos: Vec3 = [shoulder[0] + 0.15, shoulder[1] - 0.2, shoulder[2] + 0.18]
    const limbAxis = normalize(sub([...pos], shoulder))
    const pole: V3 = normalize([0.6, -0.6, -0.5])
    // The pole turned 90° about the limb's axis (Rodrigues at 90°: k × v + k (k · v)), still not square to it.
    const turned = add(cross(limbAxis, pole), scale(limbAxis, dot(limbAxis, pole)))
    const solveWith = (dir: Vec3): ReturnType<typeof solve> =>
      solve(
        WICK,
        restPose(),
        targets({ effectors: { handL: { pos } }, poles: { elbowL: { dir } } }),
        OPEN_LIMITS,
      )
    const before = solveWith(pole),
      after = solveWith(turned)
    expect(Math.abs(dot(limbAxis, pole))).toBeGreaterThan(0.1)
    const turn = Math.acos(dot(bendDirection(before.world, 'handL'), bendDirection(after.world, 'handL')))
    expect(Math.abs(turn - Math.PI / 2)).toBeLessThan(1e-9)
    expect(distance(at3(before.world, c), at3(after.world, c))).toBeLessThan(1e-6)
  })
  it("bends knees forward and elbows back by default (the source's poles), as positive flexion", () => {
    const k = unit(WICK)
    const base = restPose()
    const hip = scale(at(WICK.rest, J['thigh.L']), 1 / k),
      shoulder = scale(at(WICK.rest, J['upperArm.R']), 1 / k)
    const { pose, world } = solve(
      WICK,
      base,
      targets({
        effectors: {
          footL: { pos: [hip[0], hip[1] - 0.4, hip[2]] },
          handR: { pos: [shoulder[0], shoulder[1] - 0.2, shoulder[2] + 0.1] },
        },
      }),
      OPEN_LIMITS,
    )
    const toRoot = invertRigid(at(world, J.root))
    expect(bendDirection(world, 'footL')[2]).toBeGreaterThan(0.9)
    expect(applyDir(toRoot, bendDirection(world, 'handR'))[2]).toBeLessThan(0)
    expect(hingeFlexion(at(pose.rot, J['shin.L']), 'knee')).toBeGreaterThan(0)
    expect(hingeFlexion(at(pose.rot, J['foreArm.R']), 'elbow')).toBeGreaterThan(0)
  })
})
