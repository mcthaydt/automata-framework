import { describe, expect, it, vi } from 'vitest'
import { BASE } from '#src/features/painted/base/base.ts'
import { measure } from '#src/features/painted/body/genes.ts'
import { J, skeleton } from '#src/features/painted/body/rig.ts'
import { apply, invertRigid, position } from '#src/features/painted/lib/math.ts'
import { SIT, seated } from '#src/features/painted/motion/motion.ts'
import { GAITS, SEATS } from '#src/features/painted/motion/presets.ts'

// Each case paints whole figures, seconds apiece with the suite's files side by side; the source's own suite allows
// 30 s, and so does this file.
vi.setConfig({ testTimeout: 30_000 })

/**
 * The seated stands (motion.ts seated, library/seats.json): no base figure sits, so this is what keeps them from being
 * cut as dead. For every seat, on the base man, the hips land on the seat (its height plus the thigh's flesh under the
 * hip joint, less what a slump sinks them) and both ankles stand on the floor, in the root's space; and a seat is drawn
 * the same every time it is asked for. (The hips are the thigh joints: the pelvis joint itself sits above them.)
 */
const def = BASE[0]!.def,
  m = measure(def.sliders),
  s = skeleton(m.genes),
  gait = GAITS[def.gait],
  k = s.genes.height / 1.62
/** A joint's place in the root's space. */
const inRoot = (world: ReturnType<typeof seated>['world'], joint: number) =>
  apply(invertRigid(world[J.root]!), position(world[joint]!))

describe('every seat', () => {
  for (const [name, seat] of Object.entries(SEATS))
    it(name, () => {
      const { world } = seated(s, gait!, seat, 0.3)
      for (const side of ['L', 'R'] as const) {
        expect(inRoot(world, J[`thigh.${side}`])[1], `${side} hip`).toBeCloseTo(
          seat.height + SIT * k - 0.03 * k * (seat.slump ?? 0),
          2,
        )
        expect(Math.abs(inRoot(world, J[`foot.${side}`])[1] - s.genes.ankle), `${side} ankle`).toBeLessThan(
          0.001,
        )
      }
      expect(seated(s, gait!, seat, 0.3).pose).toEqual(seated(s, gait!, seat, 0.3).pose)
    })
  it('the library has the seats the library names', () => {
    expect(Object.keys(SEATS)).toEqual([
      'upright',
      'slump',
      'typing',
      'leanIn',
      'mouse',
      'reachClick',
      'toMouth',
      'triumph',
    ])
  })
})
