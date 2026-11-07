import { describe, expect, it } from 'vitest'
import { measure } from '#src/features/figures/body/genes.ts'
import { JOINTS } from '#src/features/figures/body/rig.ts'
import { genesOf, skeleton, skeletonProblems } from '#src/features/figures/figure/figure-skeleton.ts'
import { KEEPER_SLIDERS, WICK_SLIDERS } from '#src/testing/fixture-sliders.ts'

const wick = { sliders: WICK_SLIDERS }
const keeper = { sliders: KEEPER_SLIDERS }

describe('F-a: two fixture figures with different sliders, one generator', () => {
  it('builds both on the same 27 joints and parents', () => {
    expect(skeleton(wick).rest).toHaveLength(JOINTS.length)
    expect(skeleton(keeper).rest).toHaveLength(JOINTS.length)
  })
  it("gives bone lengths that follow each figure's sliders", () => {
    const w = skeleton(wick)
    const k = skeleton(keeper)
    // The height slider in centimetres is the crown's height in metres.
    expect(w.genes.height).toBe(1.2)
    expect(k.genes.height).toBe(1.86)
    // The keeper's arms and legs sliders are higher, so his limbs are longer for his height too.
    expect((k.upperArm + k.foreArm) / k.genes.height).toBeGreaterThan(
      (w.upperArm + w.foreArm) / w.genes.height,
    )
    expect((k.thigh + k.shin) / k.genes.height).toBeGreaterThan((w.thigh + w.shin) / w.genes.height)
    // Wick's head slider is at the top, so his head is a bigger share of his height.
    expect(w.genes.head / w.genes.height).toBeGreaterThan(k.genes.head / k.genes.height)
    // And the lengths are the genes' own: the arm splits at the forearm's share.
    expect(k.foreArm / (k.upperArm + k.foreArm)).toBeCloseTo(0.47, 12)
  })
  it('moves one bone when one slider moves, with the same generator', () => {
    const longer = skeleton({ sliders: { ...WICK_SLIDERS, arms: 0.9 } })
    const w = skeleton(wick)
    expect(longer.upperArm).toBeGreaterThan(w.upperArm)
    expect(longer.thigh).toBe(w.thigh)
  })
  it("applies a figure's gene overrides after its sliders", () => {
    expect(genesOf({ sliders: WICK_SLIDERS, genes: { forearm: 0.5 } })).toEqual({
      ...measure(WICK_SLIDERS).genes,
      forearm: 0.5,
    })
  })
})

describe('skeletonProblems: impossible skeletons name what set them', () => {
  it('finds nothing wrong with the fixture figures', () => {
    expect(skeletonProblems(wick)).toEqual([])
    expect(skeletonProblems(keeper)).toEqual([])
  })
  it('names the legs slider when the pelvis rises above the chest', () => {
    const problems = skeletonProblems({ sliders: { ...WICK_SLIDERS, legs: 2, head: 2, neckLength: 2 } })
    expect(problems).toHaveLength(1)
    expect(problems[0]?.path).toEqual(['sliders', 'legs'])
    expect(problems[0]?.message).toMatch(/^legs 2 gives the spine a length of -0\.\d+ m/)
    expect(problems[0]?.message).toContain('head, neckLength')
  })
  it('names a gene override when it, not a slider, breaks a bone', () => {
    const problems = skeletonProblems({ sliders: WICK_SLIDERS, genes: { arms: -0.4 } })
    expect(problems.map((p) => p.path)).toEqual([
      ['genes', 'arms'],
      ['genes', 'arms'],
    ])
    expect(problems[0]?.message).toMatch(/^genes\.arms -0\.4 gives the upper arm a length of -/)
  })
})
