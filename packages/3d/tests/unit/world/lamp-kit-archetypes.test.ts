// The lamp kit covers a reference game's lamps. The old game's archetypes are copied here as it had them (`src/render/look.ts`
// at `92e6704`: `ARCHETYPES`), the kit as it was before the bands were widened is copied beside them, and the kit now:
// - accepts a lamp of each old archetype at its old colour, its old reach (the ends of its band, not clamped) and its old level;
// - gives every lamp the kit accepted before the same light: the same colour, level and, left to the kit, the same range.
import { describe, expect, it } from 'vitest'
import { LAMP_KINDS, lampFault, resolveLamp } from '#src/features/world/lamp-kit.ts'

type Numbers = { color: string; range: [number, number]; peak: number }

const OLD_GAME: Record<string, Numbers> = {
  pendant: { color: '#ffd59b', range: [5.5, 9], peak: 1.0 },
  bulb: { color: '#ffce7f', range: [3.5, 6], peak: 1.5 },
  desk: { color: '#ffbc4e', range: [3.5, 5.5], peak: 1.25 },
  fluorescent: { color: '#eadbc9', range: [4, 8], peak: 1.25 },
  sodium: { color: '#ffbc4e', range: [6, 10], peak: 1.25 },
  fire: { color: '#f99b4e', range: [4, 6.5], peak: 1.5 },
  gas: { color: '#9c9bef', range: [3, 5], peak: 1.25 },
  screen: { color: '#91daa1', range: [2, 3.5], peak: 1.5 },
  moon: { color: '#96b2d9', range: [3, 5], peak: 1.0 },
  fill: { color: '#96b2d9', range: [3.5, 6], peak: 1.25 },
  spark: { color: '#6dccff', range: [3, 5], peak: 2.5 },
}

/** The kit before this change: what every lamp accepted then must still draw as. */
const KIT_BEFORE: Record<string, Numbers> = {
  pendant: { color: '#ffd59b', range: [3.5, 6], peak: 1.0 },
  bulb: { color: '#ffce7f', range: [3.5, 6], peak: 1.5 },
  desk: { color: '#ffbc4e', range: [3.5, 5.5], peak: 1.25 },
  fluorescent: { color: '#eadbc9', range: [4, 8], peak: 1.25 },
  sodium: { color: '#ffbc4e', range: [6, 10], peak: 1.25 },
  neon: { color: '#ff7daf', range: [1.5, 3.5], peak: 1.25 },
  moon: { color: '#b4c8ff', range: [4, 9], peak: 0.7 },
  fill: { color: '#d9d4cc', range: [5, 10], peak: 0.5 },
}

const hex = (color: string): number => Number.parseInt(color.slice(1), 16)

// The kit's moon and fill are the builder's own (another colour and peak than the old game's, so a lamp at the old colour is
// off their tone); the old game's two are a coloured glow, which the kit already has as `neon`.
const KIND_FOR: Record<string, string> = { moon: 'neon', fill: 'neon' }

describe('a lamp of each old archetype', () => {
  describe.each(Object.entries(OLD_GAME))('%s', (name, old) => {
    const kind = KIND_FOR[name] ?? name

    it(`is accepted as a ${kind} at its old colour`, () => {
      expect(lampFault({ kind, color: old.color })).toBeUndefined()
    })

    it('keeps both ends of its old reach, not clamped', () => {
      for (const reach of old.range)
        expect(resolveLamp({ kind, color: old.color, range: reach, level: undefined }).range).toBe(reach)
    })

    it('burns at its old peak and its old colour', () => {
      const resolved = resolveLamp({ kind, color: old.color, range: undefined, level: old.peak })
      expect(resolved.level).toBe(old.peak)
      expect(resolved.color).toBe(hex(old.color))
    })
  })

  it('the three kinds the reference game lacked are steady lamps: no dusk, no flicker', () => {
    for (const kind of ['fire', 'screen', 'spark']) expect(LAMP_KINDS[kind]).toBeDefined()
    for (const kind of ['fire', 'gas', 'screen', 'spark'])
      expect(resolveLamp({ kind, color: undefined, range: undefined, level: undefined }).dusk).toBe(false)
  })
})

describe('a lamp the kit accepted before', () => {
  describe.each(Object.entries(KIT_BEFORE))('%s', (kind, before) => {
    const [low, high] = before.range
    const unset = { color: undefined, range: undefined, level: undefined }

    it('is still accepted, at its own colour and with none', () => {
      expect(lampFault({ kind, color: undefined })).toBeUndefined()
      expect(lampFault({ kind, color: before.color })).toBeUndefined()
    })

    it('left to the kit, gets the range it got: the middle of the band it had', () => {
      expect(resolveLamp({ kind, ...unset }).range).toBe((low + high) / 2)
    })

    it('draws the same for any reach inside the band it had, and at its peak', () => {
      for (const reach of [low, (low + high) / 2, high]) {
        const resolved = resolveLamp({ kind, color: undefined, range: reach, level: undefined })
        expect(resolved.range).toBe(reach)
        expect(resolved.color).toBe(hex(before.color))
        expect(resolved.level).toBe(Math.min(1, before.peak))
      }
      expect(resolveLamp({ kind, color: undefined, range: undefined, level: 9 }).level).toBe(before.peak)
    })
  })

  it('the kit has no kind fewer than before', () => {
    expect(Object.keys(LAMP_KINDS)).toEqual(expect.arrayContaining(Object.keys(KIT_BEFORE)))
  })
})
