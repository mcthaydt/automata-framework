import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '#src/features/look/look.ts'
import { worldTexel } from '#src/features/look/world-texel.ts'
import { DUEL } from '#src/shared/math/duel.ts'
import { environmentBuilderLook } from '#src/testing/oracles.ts'

const oracle = environmentBuilderLook()
// The source's measurement used its own haze and dither; the look's are the same numbers.
const look = {
  ...DEFAULT_LOOK,
  dither: { strength: oracle.shadeLook.dither },
  haze: oracle.shadeLook.haze as unknown as typeof DEFAULT_LOOK.haze,
}

describe('a world texel', () => {
  it("is EnvironmentBuilder's shade for each of its 500 samples", () => {
    let wrong = 0
    for (const s of oracle.shade)
      if (
        worldTexel(
          s.albedo,
          s.light,
          s.share,
          s.x,
          s.y,
          { ...look, light: { ...look.light, gain: 1 } },
          false,
        ) !== s.out
      )
        wrong++
    expect(wrong).toBe(0)
  })

  it('a DUEL colour at full light with no haze is itself when nothing is dithered', () => {
    const flat = { ...DEFAULT_LOOK, dither: { strength: 0 } }
    for (const { c: colour } of DUEL.slice(0, 64))
      for (let x = 0; x < 4; x++)
        for (let y = 0; y < 4; y++) expect(worldTexel(colour, [1, 1, 1], 0, x, y, flat, true)).toBe(colour)
  })

  it('rounds each channel to a byte first when the target stores 8 bits, which can change a snap', () => {
    // Half a byte over a channel: unrounded it is a hair under the next byte's colour, rounded it is on it.
    const a = worldTexel(0x10203f, [1.004, 1, 1], 0, 0, 0, DEFAULT_LOOK, false)
    const b = worldTexel(0x10203f, [1.004, 1, 1], 0, 0, 0, DEFAULT_LOOK, true)
    const palette = DUEL.map((d) => d.c)
    expect(palette).toContain(a)
    expect(palette).toContain(b)
  })
})
