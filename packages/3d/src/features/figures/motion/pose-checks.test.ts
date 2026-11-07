import { describe, expect, it } from 'vitest'
import { length, scale } from '../../../shared/math/math.ts'
import { KEEPER, WICK } from '../../../testing/solve-fixtures.ts'
import { measure } from '../body/genes.ts'
import { J, skeletonFromGenes } from '../body/rig.ts'
import type { PoseDef } from './pose.schema.ts'
import { figureReach, poseProblems, REFERENCE_SKELETON } from './pose-checks.ts'

describe('figureReach', () => {
  it('is the farthest a limb end gets from the root at rest, in figure units', () => {
    const s = REFERENCE_SKELETON
    const k = s.genes.height / 1.62
    const shoulder = length(s.rest[J['upperArm.L']] ?? [0, 0, 0])
    expect(figureReach(s)).toBeCloseTo((shoulder + s.upperArm + s.foreArm) / k, 12)
    expect(figureReach(s)).toBeCloseTo(1.845, 3)
  })
  it("is the default sliders' skeleton for the reference figure", () => {
    expect(REFERENCE_SKELETON).toEqual(skeletonFromGenes(measure({}).genes))
  })
  it("keeps Wick's and the keeper's reach within 10% of the reference's (figure units scale with height)", () => {
    for (const s of [WICK, KEEPER]) {
      expect(Math.abs(figureReach(s) / figureReach(REFERENCE_SKELETON) - 1)).toBeLessThan(0.1)
    }
  })
})

describe('poseProblems', () => {
  const bound = 2 * figureReach(REFERENCE_SKELETON)
  const along = (d: number): [number, number, number] => [0, d, 0]
  it('passes a position just inside twice the reach and refuses one just past it', () => {
    expect(poseProblems({ effectors: { handR: { pos: along(bound - 1e-9) } } })).toEqual([])
    expect(poseProblems({ effectors: { handR: { pos: along(bound + 1e-9) } } })).toEqual([
      {
        path: ['effectors', 'handR', 'pos'],
        message: expect.stringMatching(/figure units from the root, past twice the figure's reach/),
      },
    ])
  })
  it('measures a chest-space position from the root through the rest chest', () => {
    const s = REFERENCE_SKELETON
    const chest = scale(s.rest[J.chest] ?? [0, 0, 0], 1 / (s.genes.height / 1.62))
    const pose: PoseDef = { effectors: { handL: { pos: along(bound - chest[1] + 1e-6), space: 'chest' } } }
    expect(poseProblems(pose).map((p) => p.path)).toEqual([['effectors', 'handL', 'pos']])
    const inside: PoseDef = { effectors: { handL: { pos: along(bound - chest[1] - 1e-6), space: 'chest' } } }
    expect(poseProblems(inside)).toEqual([])
  })
  it("checks the root's offset", () => {
    expect(poseProblems({ effectors: {}, root: { pos: [0, 0, bound + 1] } }).map((p) => p.path)).toEqual([
      ['root', 'pos'],
    ])
  })
  it('checks against one figure when given one', () => {
    const wickBound = 2 * figureReach(WICK)
    const pose: PoseDef = { effectors: { footL: { pos: along((wickBound + bound) / 2) } } }
    const [smaller, larger] = wickBound < bound ? [WICK, REFERENCE_SKELETON] : [REFERENCE_SKELETON, WICK]
    expect(poseProblems(pose, smaller)).toHaveLength(1)
    expect(poseProblems(pose, larger)).toEqual([])
  })
})
