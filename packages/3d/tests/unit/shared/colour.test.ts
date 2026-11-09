import { DEFAULT_PALETTE } from '@automata/content/palette'
import { describe, expect, it } from 'vitest'
import { rgbFromLab } from '#src/features/photo/colour.ts'
import { labDistance, oklab } from '#src/shared/math/colour.ts'

/** OKLab with the platform's own maths, the way it was written before it ran on fdlibm. */
function builtIn(rgb: number): [number, number, number] {
  const lin = (v: number): number => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = [lin((rgb >> 16) & 255), lin((rgb >> 8) & 255), lin(rgb & 255)]
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

const duel = DEFAULT_PALETTE.colors.map((c) => Number.parseInt(c.slice(1), 16))

describe('colour on fdlibm', () => {
  it('oklab is unchanged to 1e-12 over the 256 DUEL colours', () => {
    expect(duel).toHaveLength(256)
    for (const colour of duel) {
      const got = oklab(colour)
      const want = builtIn(colour)
      for (let i = 0; i < 3; i++)
        expect(Math.abs((got[i] as number) - (want[i] as number))).toBeLessThan(1e-12)
    }
  })

  it('a colour goes to OKLab and back to itself', () => {
    for (const colour of duel) {
      const [l, a, b] = oklab(colour)
      expect(rgbFromLab(l, a, b)).toBe(colour)
    }
  })

  it('the distance of a colour to itself is nothing, and to another is the length of the difference', () => {
    expect(labDistance(0x112233, 0x112233)).toBe(0)
    const [p, q] = [oklab(0x000000), oklab(0xffffff)]
    expect(labDistance(0x000000, 0xffffff)).toBeCloseTo(
      Math.sqrt((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2),
      12,
    )
  })
})
