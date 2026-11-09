import { describe, expect, it } from 'vitest'
import { dotsOf, PARTICLE_COLOURS } from '#src/features/figures/layer/particle-motion.ts'
import { EMITTER_KINDS, type EmitterPlace } from '#src/shared/level/af-sector-2.schema.ts'

const at = [1, 2, 3] as const
const place = (kind: EmitterPlace['kind']): EmitterPlace =>
  kind === 'drip' ? { kind, at, to: [3, 2, 3], ground: 0 } : { kind, at }

describe('where an emitter’s particles are', () => {
  it.each(EMITTER_KINDS)('lets %s off as one- to three-pixel dots in the layer’s colours', (kind) => {
    const dots = dotsOf(place(kind), 0, 1.3)
    expect(dots.length).toBeGreaterThan(0)
    for (const dot of dots) {
      expect([1, 2, 3]).toContain(dot.size)
      expect(PARTICLE_COLOURS).toContain(dot.colour)
    }
  })

  it('repeats exactly for the same moment, and steps a twelfth of a second at a time', () => {
    const a = dotsOf(place('ember'), 2, 0.5)
    expect(dotsOf(place('ember'), 2, 0.5)).toEqual(a)
    expect(dotsOf(place('ember'), 2, 0.5 + 1 / 48)).toEqual(a)
    expect(dotsOf(place('ember'), 2, 0.5 + 1 / 6)).not.toEqual(a)
  })

  it('lets two alike emitters move apart, by their place in the layer', () => {
    expect(dotsOf(place('steam'), 0, 1)).not.toEqual(dotsOf(place('steam'), 3, 1))
  })

  it('lifts steam and embers above where they start, and drops drops below their edge', () => {
    for (const kind of ['steam', 'ember'] as const)
      expect(dotsOf(place(kind), 0, 0.7).every((d) => d.at[1] >= at[1])).toBe(true)
    expect(dotsOf(place('drip'), 0, 0.7).every((d) => d.at[1] <= at[1] && d.at[1] >= 0)).toBe(true)
  })

  it('lets no drops off an emitter with no edge', () => {
    expect(dotsOf({ kind: 'drip', at }, 0, 1)).toEqual([])
  })

  it('keeps moths within a short way of their lamp', () => {
    for (const dot of dotsOf(place('moth'), 0, 2.2)) {
      expect(Math.hypot(dot.at[0] - at[0], dot.at[2] - at[2])).toBeLessThanOrEqual(0.41)
      expect(Math.abs(dot.at[1] - at[1])).toBeLessThanOrEqual(0.31)
    }
  })
})
