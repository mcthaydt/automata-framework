// A library swatch's glow: only a swatch that emits has one, with its ladder and whether it shows a room behind it.
import { describe, expect, it } from 'vitest'
import { baseLibrary } from '#src/features/world/base/base-library.ts'
import { swatchGlow } from '#src/features/world/swatches.ts'

const library = {
  swatches: {
    wall: { ramp: 'grey', step: 5 },
    bulb: { ramp: 'ember', step: 7, emit: true },
    pane: { ramp: 'flame', step: 6, emit: true, interior: true },
  },
}

describe('swatchGlow', () => {
  it('is a swatch’s ladder when it emits, and nothing when it does not', () => {
    expect(swatchGlow(library, 'bulb')).toEqual({ ramp: 'ember', step: 7, interior: false })
    expect(swatchGlow(library, 'wall')).toBeUndefined()
    expect(swatchGlow(library, 'missing')).toBeUndefined()
  })
  it('says a lit window shows a room', () => {
    expect(swatchGlow(library, 'pane')?.interior).toBe(true)
  })
  it('takes a seeded name from its base', () => {
    expect(swatchGlow(library, 'bulb#12')?.ramp).toBe('ember')
  })
  it('finds the base scenes’ bulb', () => {
    expect(swatchGlow(baseLibrary, 'bulbWarm')).toMatchObject({ ramp: 'ember', step: 7 })
  })
})
