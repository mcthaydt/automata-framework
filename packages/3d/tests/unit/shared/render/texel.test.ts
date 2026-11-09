import { describe, expect, it } from 'vitest'
import { duel, RAMPS } from '#src/shared/math/duel.ts'
import { hazed, hazeShare, litColour, snapTexel, stepLight } from '#src/shared/render/texel.ts'
import { environmentBuilderLook } from '#src/testing/oracles.ts'

const oracle = environmentBuilderLook()
const haze = oracle.shadeLook.haze as unknown as Parameters<typeof hazeShare>[1]

describe('a texel through the colour pipeline', () => {
  it("matches EnvironmentBuilder's shade for 500 texels", () => {
    expect(oracle.shade).toHaveLength(500)
    let wrong = 0
    for (const s of oracle.shade) {
      const lit = litColour(s.albedo, s.light, oracle.shadeLook.gain)
      const out = snapTexel(hazed(lit, s.light, s.share, haze), s.x, s.y, oracle.shadeLook.dither)
      if (out !== s.out) wrong++
    }
    expect(wrong).toBe(0)
  })

  it('snaps in OKLab, not in sRGB', () => {
    // A dark teal whose nearest DUEL colour by squared RGB distance is not its nearest by OKLab.
    let found = 0
    for (let g = 20; g < 120 && !found; g += 4)
      for (let b = 20; b < 120 && !found; b += 4) {
        const rgb = (6 << 16) | (g << 8) | b
        let bestRgb = Number.POSITIVE_INFINITY
        let nearest = 0
        for (const c of RAMPS.flat()) {
          const d = ((c >> 16) - 6) ** 2 + (((c >> 8) & 255) - g) ** 2 + ((c & 255) - b) ** 2
          if (d < bestRgb) {
            bestRgb = d
            nearest = c
          }
        }
        if (duel(rgb) !== nearest) found = rgb
      }
    expect(found).not.toBe(0)
    const c = [(found >> 16) / 255, ((found >> 8) & 255) / 255, (found & 255) / 255] as const
    expect(snapTexel(c, 0, 0, 0)).toBe(duel(found))
  })

  it('dithers by the Bayer cell of the texel', () => {
    const c = [0.3, 0.5, 0.4] as const
    const seen = new Set<number>()
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) seen.add(snapTexel(c, x, y, 0.5))
    expect(seen.size).toBeGreaterThan(1)
    expect(snapTexel(c, 4, 4, 0.5)).toBe(snapTexel(c, 0, 0, 0.5))
  })
})

describe('the haze and the light steps', () => {
  it('rises from none at near to amount at far', () => {
    const h = { colour: '#47655a', near: 2, far: 10, amount: 0.8, glow: 0.5 }
    expect(hazeShare(0, h)).toBe(0)
    expect(hazeShare(6, h)).toBeCloseTo(0.4, 10)
    expect(hazeShare(99, h)).toBe(0.8)
  })

  it('leaves a colour alone with no share', () => {
    const c = [0.2, 0.4, 0.6] as const
    expect(hazed(c, [1, 1, 1], 0, haze)).toBe(c)
  })

  it('steps the brightest channel and keeps the hue', () => {
    const [r, g, b] = stepLight([1.04, 0.52, 0.26], 0.1)
    expect(r).toBeCloseTo(1, 10)
    expect(g / r).toBeCloseTo(0.5, 10)
    expect(b / r).toBeCloseTo(0.25, 10)
    expect(stepLight([0, 0, 0], 0.1)).toEqual([0, 0, 0])
  })
})
