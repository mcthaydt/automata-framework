// The night palette (art direction spec §2, §4.1): every token is the Endesga 64 entry Emberwick's scene names for the
// same role, read from the one palette source, so the two games cannot drift apart.
import { DEFAULT_PALETTE } from '@mcthaydt/automata-content/palette'
import { describe, expect, it } from 'vitest'
import { colour, TOKENS } from './palette.ts'

describe('the night palette', () => {
  it('names the entries Emberwick uses for each role', () => {
    expect(TOKENS).toMatchObject({
      night: 15,
      skyHigh: 52,
      skyMid: 39,
      skyLow: 38,
      skyDeep: 40,
      moonlight: 45,
      mushroom: 43,
      ember: 30,
      lantern: 31,
      firefly: 33,
      spark: 32,
      hot: 28,
      grass: 35,
      grassTip: 34,
      moss: 36,
    })
  })

  it("lights the 3D stone from above with a saturated blue, not Emberwick's grey-blue clear colour (11)", () => {
    // On the 3D stone under the moonlight, 11 reads grey; 41 keeps the 2D frame's blue (art pass step 14).
    expect(TOKENS.ambientSky).toBe(41)
  })

  it('reads each colour from the default palette', () => {
    for (const [name, index] of Object.entries(TOKENS))
      expect(colour(name as keyof typeof TOKENS), name).toBe(
        Number.parseInt((DEFAULT_PALETTE.colors[index] as string).slice(1), 16),
      )
    expect(colour('moonlight')).toBe(0x94fdff)
  })
})
