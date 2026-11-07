import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  DUEL_RAMP_NAMES,
  DUEL_RAMPS,
  duelIndex,
  nearestDuel,
  rampOf,
  step,
} from '#src/shared/palette/duel.ts'
import {
  checkPalette,
  DEFAULT_PALETTE,
  paletteSchema,
  parsePaintNetPalette,
} from '#src/shared/palette/palette.ts'

const duelFile = readFileSync(
  new URL('../../../../../../docs/art/palettes/duel.txt', import.meta.url),
  'utf8',
)

describe('the default palette', () => {
  it('is DUEL: 256 colours, ramp r step s at r * 8 + s', () => {
    expect(DEFAULT_PALETTE.name).toBe('DUEL')
    expect(DEFAULT_PALETTE.colors).toHaveLength(256)
    expect(DEFAULT_PALETTE.colors[3 * 8 + 5]).toBe(DUEL_RAMPS[3]?.[5])
    expect(rampOf(3 * 8 + 5)).toBe(3)
  })

  it('is docs/art/palettes/duel.txt, in order', () => {
    expect(parsePaintNetPalette(duelFile)).toEqual(DEFAULT_PALETTE.colors)
  })

  it('is 32 ramps of 8 lowercase #rrggbb colours, none repeated', () => {
    expect(DUEL_RAMPS).toHaveLength(32)
    for (const ramp of DUEL_RAMPS) {
      expect(ramp).toHaveLength(8)
      for (const colour of ramp) expect(colour).toMatch(/^#[0-9a-f]{6}$/)
    }
    expect(new Set(DEFAULT_PALETTE.colors).size).toBe(256)
  })
})

describe('the ramps have names', () => {
  it('32 names, each a lowercase word, none repeated, in ramp order', () => {
    expect(DUEL_RAMP_NAMES).toHaveLength(32)
    expect(new Set(DUEL_RAMP_NAMES).size).toBe(32)
    for (const name of DUEL_RAMP_NAMES) expect(name).toMatch(/^[a-z]+$/)
    expect(DUEL_RAMP_NAMES[0]).toBe('grey')
    expect(DUEL_RAMP_NAMES[2]).toBe('skin')
  })
  it('name the ramp, and step it, to a palette index', () => {
    expect(duelIndex('skin', 5)).toBe(2 * 8 + 5)
    expect(duelIndex('grey', 0)).toBe(0)
    expect(duelIndex('ember', 7)).toBe(255)
    expect(DEFAULT_PALETTE.colors[duelIndex('skin', 5)]).toBe('#d58d6b')
  })
  it('refuse a step outside 0 to 7', () => {
    expect(() => duelIndex('skin', 8)).toThrow('step is 0 to 7')
    expect(() => duelIndex('skin', -1)).toThrow('step is 0 to 7')
    expect(() => duelIndex('skin', 1.5)).toThrow('step is 0 to 7')
  })
})

describe('step', () => {
  it('moves along a ramp and stops at its ends', () => {
    expect(step(3 * 8 + 6, 4)).toBe(3 * 8 + 7)
    expect(step(3 * 8 + 1, -4)).toBe(3 * 8)
    expect(step(3 * 8 + 3, 2)).toBe(3 * 8 + 5)
  })
})

describe('nearestDuel', () => {
  it('finds a colour that is in the palette, exactly', () => {
    for (const index of [0, 77, 255]) expect(nearestDuel(DEFAULT_PALETTE.colors[index] ?? '')).toBe(index)
  })
  it('finds the closest by OKLab for a colour that is not', () => {
    // Pure white is nearer the top of the grey ramp (#f5f7fa) than anything else.
    expect(nearestDuel('#ffffff')).toBe(7)
    expect(nearestDuel('#FFFFFF')).toBe(7)
  })
  it('refuses a colour that is not #rrggbb', () => {
    expect(() => nearestDuel('white')).toThrow(/like #ff0040/)
  })
})

describe('parsePaintNetPalette', () => {
  it('reads AARRGGBB lines, skipping comments and blank lines', () => {
    expect(parsePaintNetPalette(';comment\r\nFFff0040\n\nff131313\n')).toEqual(['#ff0040', '#131313'])
  })
})

describe('checkPalette', () => {
  it('uses DUEL when the game has no palette.toml', () => {
    expect(checkPalette(undefined)).toEqual({ palette: DEFAULT_PALETTE, problems: [] })
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
