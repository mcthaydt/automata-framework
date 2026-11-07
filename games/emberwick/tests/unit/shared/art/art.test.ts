import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { duel } from '#src/shared/art/palette.ts'
import { ALL_SPRITES } from '#src/shared/art/sprites.ts'

// The palette gate the pipelines will run in M3, in miniature: every colour the base draws is a DUEL colour,
// checked against the palette file (docs/art/palettes/duel.txt, paint.net AARRGGBB lines).
const fromFile = readFileSync(
  new URL('../../../../../../docs/art/palettes/duel.txt', import.meta.url),
  'utf8',
)
  .split(/\r?\n/)
  .filter((line) => line !== '' && !line.startsWith(';'))
  .map((line) => `#${line.slice(2).toLowerCase()}`) // AARRGGBB → #rrggbb

describe('the palette', () => {
  it('looks colours up by their index in DUEL', () => {
    expect(fromFile).toHaveLength(256)
    expect(duel(0)).toBe('#000000')
    expect(duel(255)).toBe('#f7f4bf')
    expect(() => duel(256)).toThrow('DUEL has no colour 256')
  })
})

describe('the sprites', () => {
  it.each(Object.entries(ALL_SPRITES))('%s is a rectangle of known palette keys', (_name, sprite) => {
    expect(sprite.rows).toHaveLength(sprite.height)
    for (const row of sprite.rows) {
      expect(row).toHaveLength(sprite.width)
      for (const key of row) if (key !== '.') expect(sprite.palette).toHaveProperty(key)
    }
  })

  it.each(Object.entries(ALL_SPRITES))('%s uses only DUEL colours', (_name, sprite) => {
    for (const colour of Object.values(sprite.palette)) expect(fromFile).toContain(colour)
  })
})
