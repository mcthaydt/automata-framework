import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ENDESGA_64, endesga } from '#src/shared/art/palette.ts'
import { ALL_SPRITES } from '#src/shared/art/sprites.ts'

// The palette gate the pipelines will run in M3, in miniature: every color the base draws is an Endesga 64
// color, checked against the palette file exactly as the Owner supplied it (docs/art/palettes/endesga-64.txt).
const paletteFile = readFileSync(
  new URL('../../../../../../docs/art/palettes/endesga-64.txt', import.meta.url),
  'utf8',
)
const fromFile = paletteFile
  .split(/\r?\n/)
  .filter((line) => line !== '' && !line.startsWith(';'))
  .map((line) => `#${line.slice(2).toLowerCase()}`) // AARRGGBB → #rrggbb

describe('the palette', () => {
  it('is Endesga 64, in the file’s order', () => {
    expect(fromFile).toHaveLength(64)
    expect(ENDESGA_64).toEqual(fromFile)
  })

  it('looks colors up by their index in the file', () => {
    expect(endesga(0)).toBe('#ff0040')
    expect(endesga(63)).toBe('#571c27')
    expect(() => endesga(64)).toThrow('Endesga 64 has no color 64')
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

  it.each(Object.entries(ALL_SPRITES))('%s uses only Endesga 64 colors', (_name, sprite) => {
    for (const color of Object.values(sprite.palette)) expect(fromFile).toContain(color)
  })
})
