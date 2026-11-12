import { DEFAULT_PALETTE } from '@automata/content/palette'
import { describe, expect, it } from 'vitest'
import { applyGrade, bayer8, lumaWeightedThreshold, retroColour } from '#src/features/retro/retro-colour.ts'
import { RETRO_CLINIC, RETRO_NEUTRAL } from '#src/features/retro/retro-profile.schema.ts'

const rgb = (hex: string): [number, number, number] => [
  ((Number.parseInt(hex.slice(1), 16) >> 16) & 255) / 255,
  ((Number.parseInt(hex.slice(1), 16) >> 8) & 255) / 255,
  (Number.parseInt(hex.slice(1), 16) & 255) / 255,
]

describe('the neutral profile', () => {
  it('lets every DUEL colour through exactly', () => {
    for (const hex of DEFAULT_PALETTE.colors) expect(retroColour(RETRO_NEUTRAL, rgb(hex))).toEqual(rgb(hex))
  })
})

describe('the clinic profile', () => {
  it('cools and dims a warm DUEL colour (warmth is negative, saturation under 1)', () => {
    const before = rgb('#e8b060')
    const after = retroColour(RETRO_CLINIC, before)
    expect(after[0]).toBeLessThan(before[0])
    expect(after[2] / after[0]).toBeGreaterThan(before[2] / before[0])
  })

  it('lifts black to the fade colour times lift, and settles white at `white`', () => {
    const black = retroColour(RETRO_CLINIC, [0, 0, 0])
    expect(black[0]).toBeCloseTo((0x4b / 255) * 0.13, 4)
    expect(black[1]).toBeCloseTo((0x5a / 255) * 0.13, 4)
    const white = retroColour(RETRO_CLINIC, [1, 1, 1])
    expect(Math.max(...white)).toBeLessThanOrEqual(0.96 + 1e-9)
  })
})

describe('applyGrade', () => {
  it('turns a colour under the black crush grey', () => {
    const out = applyGrade({ ...RETRO_NEUTRAL.grade, blackCrush: 0.5, moodBlend: 1 }, [0.4, 0.1, 0.1])
    expect(out[0]).toBeCloseTo(out[1], 9)
    expect(out[1]).toBeCloseTo(out[2], 9)
  })

  it('stays in 0 to 1', () => {
    for (const c of applyGrade({ ...RETRO_CLINIC.grade, exposure: 3 }, [0.9, 0.8, 0.7]))
      expect(c).toBeLessThanOrEqual(1)
  })
})

describe('the ordered dither', () => {
  it('reads the 8 x 8 Bayer matrix from bits: its first row, and every entry once', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((x) => bayer8(x, 0))).toEqual([0, 32, 8, 40, 2, 34, 10, 42])
    const seen = new Set<number>()
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) seen.add(bayer8(x, y))
    expect(seen.size).toBe(64)
  })

  it('weights the threshold by luma and tapers it to nothing in deep shadow', () => {
    expect(lumaWeightedThreshold(0.4, 0.01, 0.5)).toBe(0)
    expect(lumaWeightedThreshold(0.4, 0.5, 0.5)).toBeCloseTo(0.4 * 0.75, 9)
  })
})
