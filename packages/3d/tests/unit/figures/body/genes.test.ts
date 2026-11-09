import { describe, expect, it } from 'vitest'
import { DEFAULT_HEAD, DEFAULT_SLIDERS, measure } from '#src/features/figures/body/genes.ts'
import { KEEPER_SLIDERS, WICK_SLIDERS } from '#src/testing/fixture-sliders.ts'

describe('gene sliders', () => {
  it('fills left-out sliders from the defaults', () => {
    expect(measure({}).sliders).toEqual(DEFAULT_SLIDERS)
    expect(measure({ height: 150 }).sliders).toEqual({ ...DEFAULT_SLIDERS, height: 150 })
  })
  it('reads the height in centimetres and scales the fixed details by height / 1.62', () => {
    const m = measure({ height: 162 })
    expect(m.genes.height).toBe(1.62)
    expect(m.k).toBeCloseTo(1, 15)
  })
  it('fills the head shape from the average head, keeping what the figure sets', () => {
    expect(measure({}).face).toEqual(DEFAULT_HEAD)
    expect(measure({ face: { jaw: 0.9, lips: 0.2 } }).face).toEqual({ ...DEFAULT_HEAD, jaw: 0.9, lips: 0.2 })
  })
  it("gives the source's genes for Wick and the keeper", () => {
    // From measure(), run on Node 24 with these sliders.
    expect(measure(WICK_SLIDERS).genes).toEqual({
      height: 1.2,
      head: 0.2016,
      headWidth: 0.7902003200000001,
      headDepth: 0.84,
      neck: 0.027,
      shoulders: 0.11802126336000002,
      hips: 0.06492959999999999,
      legs: 0.48608,
      arms: 0.39479999999999993,
      forearm: 0.47,
      ankle: 0.061111111111111116,
      foot: 0.195696,
      build: 1.0445904,
      posture: 0.06999999999999999,
      headTilt: 0,
      headPitch: 0.044000000000000004,
      faceAhead: 0.25,
      hunch: 0,
      sideBend: 0,
    })
    const keeper = measure(KEEPER_SLIDERS).genes
    expect(keeper.arms).toBe(0.74493)
    expect(keeper.hunch).toBe(0.4)
    expect(keeper.posture).toBe(0.26799999999999996)
  })
  it('thickens limbs, hands and feet for the pixel build (chunk)', () => {
    const life = measure({ chunk: 0 }),
      pixel = measure({ chunk: 1 })
    expect(pixel.arm).toBeGreaterThan(life.arm)
    expect(pixel.leg).toBeGreaterThan(life.leg)
    expect(pixel.hand).toBeGreaterThan(life.hand)
    expect(pixel.genes.head).toBeGreaterThan(life.genes.head)
  })
})
