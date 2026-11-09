// Strafing and backing away (`moveDir`, M3 spec §4.4.1, M3.5c decisions 4 and 12): new for AF, so these are
// AF's own checks, from the M3.5c review. A lock-on circle strafe sits at moveDir ±π/2 with noise on it, so the
// legs must never cross, the pose must not jump as moveDir crosses the strafe line, and the hips must ride the
// planted feet as they do walking forward.

import { beforeAll, describe, expect, it } from 'vitest'
import { at, J, type Skeleton } from '#src/features/figures/body/rig.ts'
import type { Gait } from '#src/features/figures/content/gait.schema.ts'
import { type FigureBody, skeleton } from '#src/features/figures/figure/figure-skeleton.ts'
import { base } from '#src/features/figures/motion/base.ts'
import { BACK_BAND, walkFoot } from '#src/features/figures/motion/gait-path.ts'
import type { MotionState } from '#src/features/figures/motion/motion-state.ts'
import { apply, invertRigid, type M, position, type V3 } from '#src/shared/math/math.ts'
import { type FixtureFigures, fixtureFigures } from '#src/testing/fixture-library.ts'
import { GOLDEN_OUTFITS } from '#src/testing/golden-outfits.ts'
import { AT_REST } from '#src/testing/motion-states.ts'

let fixture: FixtureFigures
beforeAll(async () => {
  fixture = await fixtureFigures()
})
const gaitNamed = (id: string): Gait => {
  const gait = fixture.gaits[id]
  if (!gait) throw new Error(`no gait ${id}`)
  return gait
}
const bodyOf = (name: string): FigureBody => {
  const outfit = GOLDEN_OUTFITS.find((o) => o.name === name)
  if (!outfit) throw new Error(`no golden outfit ${name}`)
  return { sliders: outfit.sliders }
}
/** Wick in his gait, the lookbook model in the narrowest (strut: feet nearly on one line) and the keeper's tall
 * long-legged body in the elderly shuffle and a brisk walk. */
const CASES = (): [string, Skeleton, Gait][] => [
  ['wick bounce', skeleton(bodyOf('wick-wanderer')), gaitNamed('bounce')],
  ['model strut', skeleton(bodyOf('model-bob')), gaitNamed('strut')],
  ['keeper elderly', skeleton(bodyOf('keeper-lamplighter')), gaitNamed('elderly')],
  ['keeper brisk', skeleton(bodyOf('keeper-lamplighter')), gaitNamed('brisk')],
]
const walk = (phase: number, moveDir: number, yaw = 0.6): MotionState => ({
  ...AT_REST,
  moving: true,
  phase,
  moveDir,
  yaw,
  t: 0.5,
})
const rootSpace = (world: readonly M[], joint: number): V3 =>
  apply(invertRigid(at(world, J.root)), position(at(world, joint)))
/** Directions round the circle every 5°, with the strafe line, the back band's edges and backing away. */
const DIRECTIONS = [
  ...[...Array(72).keys()].map((i) => -Math.PI + (i * Math.PI) / 36),
  Math.PI / 2,
  -Math.PI / 2,
  Math.acos(BACK_BAND[0]),
  Math.acos(BACK_BAND[1]),
  -Math.acos(BACK_BAND[0]),
  Math.PI,
]

describe('a strafe never crosses the legs', () => {
  it('the left ankle and knee stay left of the right ones, every direction, every pose', () => {
    for (const [name, s, gait] of CASES()) {
      for (const moveDir of DIRECTIONS)
        for (let i = 0; i < 16; i++) {
          const world = base(s, gait, walk(i / 16, moveDir)).world
          for (const joint of ['foot', 'shin'] as const) {
            const gap = rootSpace(world, J[`${joint}.L`])[0] - rootSpace(world, J[`${joint}.R`])[0]
            expect(gap, `${name} moveDir ${moveDir.toFixed(3)} phase ${i}/16 ${joint}`).toBeGreaterThan(0)
          }
        }
    }
  })
})

describe('the pose is continuous in moveDir', () => {
  it('no joint moves more than 5 mm for a 1e-3 rad change of moveDir, anywhere round the circle', () => {
    for (const [name, s, gait] of CASES()) {
      for (const moveDir of DIRECTIONS)
        for (let i = 0; i < 8; i++) {
          const a = base(s, gait, walk(i / 8, moveDir - 5e-4)).world
          const b = base(s, gait, walk(i / 8, moveDir + 5e-4)).world
          let jump = 0
          for (const [j, m] of a.entries()) {
            const p = position(m)
            const q = position(at(b, j))
            jump = Math.max(jump, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]))
          }
          expect(jump, `${name} moveDir ${moveDir.toFixed(4)} phase ${i}/8`).toBeLessThan(0.005)
        }
    }
  })
})

describe('strafing, the hips ride the planted feet as walking forward', () => {
  it('every planted foot touches the floor, and the pelvis rises and falls no more than walking forward (+1 cm)', () => {
    for (const [name, s, gait] of CASES()) {
      const k = s.genes.height / 1.62
      const n = 4 * gait.walkPoses
      const heelReach = 0.2 * s.genes.foot
      const toeReach = 0.62 * s.genes.foot
      const ride = (moveDir: number) => {
        const heights: number[] = []
        for (let i = 0; i < n; i++) {
          const world = base(s, gait, walk(i / n, moveDir)).world
          heights.push(rootSpace(world, J.pelvis)[1])
          for (const side of ['L', 'R'] as const) {
            if (!walkFoot(gait, s, side, i / n, moveDir).planted) continue
            // The sole's heel and toes (the foot rolls on one or the other): the lower is on the floor.
            const foot = at(world, J[`foot.${side}`])
            const toRoot = invertRigid(at(world, J.root))
            const sole = Math.min(
              apply(toRoot, apply(foot, [0, -s.genes.ankle, -heelReach]))[1],
              apply(toRoot, apply(foot, [0, -s.genes.ankle, toeReach]))[1],
            )
            const what = `${name} moveDir ${moveDir.toFixed(3)} frame ${i} ${side}`
            expect(sole, what).toBeGreaterThan(-0.01 * k)
            expect(sole, what).toBeLessThan(0.01 * k)
          }
        }
        return Math.max(...heights) - Math.min(...heights)
      }
      const forward = ride(0)
      for (const moveDir of [Math.PI / 2, -Math.PI / 2, (3 * Math.PI) / 4, Math.PI])
        expect(ride(moveDir), `${name} moveDir ${moveDir} pelvis range`).toBeLessThanOrEqual(
          forward + 0.01 * k,
        )
    }
  })
})
