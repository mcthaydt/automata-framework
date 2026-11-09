import { DEFAULT_PALETTE } from '@automata/content/palette'
import { describe, expect, it } from 'vitest'
import { remapPalette, remapTable } from '#src/remap-palette.ts'

// A palette pull's remap: each colour of the old palette becomes the nearest DUEL colour's index.

describe('remapPalette', () => {
  it('keeps a colour that is already DUEL', () => {
    expect(remapPalette([DEFAULT_PALETTE.colors[0] ?? '', DEFAULT_PALETTE.colors[200] ?? ''])).toEqual([
      0, 200,
    ])
  })
  it('sends a colour that is not DUEL to the nearest one', () => {
    // Endesga 64's pure white is nearest the top of DUEL's grey ramp.
    expect(remapPalette(['#ffffff'])).toEqual([7])
  })
  it('answers in the order it was asked, and accepts upper case', () => {
    expect(remapPalette(['#FFFFFF', '#000000'])).toEqual([7, 0])
  })
  it('refuses a colour that is not #rrggbb, naming it', () => {
    expect(() => remapPalette(['#fff'])).toThrow('#fff')
  })
})

describe('remapTable', () => {
  it('prints one line per colour: old, new index, new colour', () => {
    expect(remapTable(['#ffffff', '#000000'])).toBe('#ffffff -> 7 #f5f7fa\n#000000 -> 0 #000000\n')
  })
})
