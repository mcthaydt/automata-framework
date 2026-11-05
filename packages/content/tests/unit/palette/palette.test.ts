import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ENDESGA_64 } from '#src/features/palette/endesga-64.ts'
import { checkPalette, paletteSchema, parsePaintNetPalette } from '#src/features/palette/palette.ts'

const endesgaFile = readFileSync(
  new URL('../../../../../docs/art/palettes/endesga-64.txt', import.meta.url),
  'utf8',
)

describe('the default palette', () => {
  it('is docs/art/palettes/endesga-64.txt, in order', () => {
    expect(parsePaintNetPalette(endesgaFile)).toEqual(ENDESGA_64)
  })

  it('has 64 unique colors', () => {
    expect(new Set(ENDESGA_64).size).toBe(64)
  })
})

describe('parsePaintNetPalette', () => {
  it('reads AARRGGBB lines, skipping comments and blank lines', () => {
    expect(parsePaintNetPalette(';comment\r\nFFff0040\n\nff131313\n')).toEqual(['#ff0040', '#131313'])
  })
})

describe('checkPalette', () => {
  it('uses Endesga 64 when the game has no palette.toml', () => {
    expect(checkPalette(undefined)).toEqual({
      palette: { name: 'Endesga 64', colors: ENDESGA_64 },
      problems: [],
    })
  })

  it('stores authored colors in lowercase', () => {
    expect(checkPalette({ name: 'Two', colors: ['#FF0040', '#131313'] }).palette).toEqual({
      name: 'Two',
      colors: ['#ff0040', '#131313'],
    })
  })

  it('refuses a duplicate color, naming both places', () => {
    expect(checkPalette({ name: 'Dup', colors: ['#ff0040', '#131313', '#FF0040'] }).problems).toEqual([
      { path: ['colors', 2], code: 'invalidPalette', message: 'color 2 (#ff0040) repeats color 0' },
    ])
  })
})

describe('paletteSchema', () => {
  const colors = (count: number) =>
    Array.from({ length: count }, (_, i) => `#${i.toString(16).padStart(6, '0')}`)

  it('takes 2 to 256 six-digit hex colors', () => {
    expect(paletteSchema.safeParse({ name: 'x', colors: colors(2) }).success).toBe(true)
    expect(paletteSchema.safeParse({ name: 'x', colors: colors(256) }).success).toBe(true)
    expect(paletteSchema.safeParse({ name: 'x', colors: colors(1) }).success).toBe(false)
    expect(paletteSchema.safeParse({ name: 'x', colors: colors(257) }).success).toBe(false)
    expect(paletteSchema.safeParse({ name: 'x', colors: ['#fff', '#000000'] }).success).toBe(false)
  })
})
