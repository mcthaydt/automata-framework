// The old game's dither was `strength × (1 − 0.5 × luma)`, and nothing at all in the deep blacks (`smoothstep(0.02, 0.08, luma)`):
// speckle fell away in the lights and no crawling noise sat in the dark. Both are opt-in, `lumaWeight` and `shadowTaper`, and a look
// that sets neither dithers exactly as before.
import { describe, expect, it } from 'vitest'
import { ditherAmplitude, duelSnap } from '#src/features/look/duel-snap.ts'
import { DuelSnapEffect } from '#src/features/look/duel-snap-filter.ts'
import { DEFAULT_LOOK, parseLook } from '#src/features/look/look.ts'

describe('the dither amplitude', () => {
  it('is the strength at every luma when neither option is set (the look as it was)', () => {
    for (const luma of [0, 0.01, 0.05, 0.4, 1]) expect(ditherAmplitude(luma, 0.04, {})).toBe(0.04)
  })

  it('falls with luma by `lumaWeight`: the old 0.5 halves it at white and takes a tenth off at 0.2', () => {
    expect(ditherAmplitude(1, 0.04, { lumaWeight: 0.5 })).toBeCloseTo(0.02, 8)
    expect(ditherAmplitude(0.2, 0.04, { lumaWeight: 0.5 })).toBeCloseTo(0.036, 8)
    expect(ditherAmplitude(0, 0.04, { lumaWeight: 0.5 })).toBeCloseTo(0.04, 8)
  })

  it('with `shadowTaper` is nothing under 0.02 of luma, whole from 0.08, and a smoothstep between', () => {
    expect(ditherAmplitude(0.02, 0.04, { shadowTaper: true })).toBe(0)
    expect(ditherAmplitude(0, 0.04, { shadowTaper: true })).toBe(0)
    expect(ditherAmplitude(0.08, 0.04, { shadowTaper: true })).toBeCloseTo(0.04, 8)
    expect(ditherAmplitude(0.5, 0.04, { shadowTaper: true })).toBeCloseTo(0.04, 8)
    const t = (0.05 - 0.02) / (0.08 - 0.02)
    expect(ditherAmplitude(0.05, 0.04, { shadowTaper: true })).toBeCloseTo(0.04 * t * t * (3 - 2 * t), 8)
  })

  it('multiplies the two when both are set', () => {
    expect(ditherAmplitude(0.5, 0.04, { lumaWeight: 0.5, shadowTaper: true })).toBeCloseTo(0.04 * 0.75, 8)
  })
})

describe('the snap with them', () => {
  const dark: [number, number, number] = [0.01, 0.012, 0.014]
  it('lands a deep-black colour on one palette colour in every Bayer cell once tapered, and on more without', () => {
    const tapered = new Set<number>()
    const plain = new Set<number>()
    for (let cell = 0; cell < 16; cell++) {
      tapered.add(duelSnap(dark, cell & 3, cell >> 2, 0.5, { shadowTaper: true }))
      plain.add(duelSnap(dark, cell & 3, cell >> 2, 0.5))
    }
    expect(tapered.size).toBe(1)
    expect(plain.size).toBeGreaterThan(1)
  })

  it('is the old snap when no option is given', () => {
    for (let cell = 0; cell < 16; cell++) {
      const rgb: [number, number, number] = [0.3, 0.35, 0.4]
      expect(duelSnap(rgb, cell & 3, cell >> 2, 0.04, {})).toBe(duelSnap(rgb, cell & 3, cell >> 2, 0.04))
    }
  })
})

describe('the look and the pass', () => {
  it('a look has neither option unless it sets them, and they parse', () => {
    expect(DEFAULT_LOOK.dither.lumaWeight ?? 0).toBe(0)
    expect(DEFAULT_LOOK.dither.shadowTaper ?? false).toBe(false)
    const set = parseLook({ dither: { strength: 0.04, lumaWeight: 0.5, shadowTaper: true } })
    expect(set.dither).toEqual({ strength: 0.04, lumaWeight: 0.5, shadowTaper: true })
    expect(() => parseLook({ dither: { strength: 0.04, lumaWeight: 2 } })).toThrow(/lumaWeight/)
  })

  it('the snap effect carries them as uniforms the shader reads, off by default', () => {
    const plain = new DuelSnapEffect(0.04)
    expect(plain.lumaWeight).toBe(0)
    expect(plain.shadowTaper).toBe(0)
    const weighted = new DuelSnapEffect(0.04, { lumaWeight: 0.5, shadowTaper: true })
    expect(weighted.lumaWeight).toBe(0.5)
    expect(weighted.shadowTaper).toBe(1)
  })
})
