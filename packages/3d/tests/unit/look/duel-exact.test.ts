// A figure's texels are already DUEL colours, and the look pass runs over the whole view. A texel that is exactly a DUEL
// colour must come out as itself, in every cell of the Bayer matrix: no dither and no remap of a colour already in the palette.
import { DEFAULT_PALETTE } from '@automataframework/content/palette'
import { describe, expect, it } from 'vitest'
import { BAYER, duelSnap } from '#src/features/look/duel-snap.ts'
import { DEFAULT_LOOK } from '#src/features/look/look.ts'

const palette = DEFAULT_PALETTE.colors.map((hex) => Number.parseInt(hex.slice(1), 16))
const channels = (c: number): [number, number, number] => [
  ((c >> 16) & 255) / 255,
  ((c >> 8) & 255) / 255,
  (c & 255) / 255,
]

describe('the snap leaves an exact DUEL colour alone', () => {
  it('maps every palette colour to itself in every Bayer cell', () => {
    const moved: string[] = []
    for (const colour of palette)
      for (let cell = 0; cell < BAYER.length; cell++) {
        const got = duelSnap(channels(colour), cell & 3, cell >> 2, DEFAULT_LOOK.dither.strength)
        if (got !== colour) moved.push(`${colour.toString(16)}@${cell} -> ${got.toString(16)}`)
      }
    expect(moved).toEqual([])
  })

  it('still lands a colour between two palette colours on both', () => {
    const [a, b] = [palette[0] as number, palette[1] as number]
    const mid = channels(a).map((v, i) => (v + (channels(b)[i] as number)) / 2) as [number, number, number]
    const seen = new Set<number>()
    for (let cell = 0; cell < 16; cell++) seen.add(duelSnap(mid, cell & 3, cell >> 2, 0.5))
    expect(seen.size).toBeGreaterThan(1)
  })
})
