// The particles' sprites, worked out on the CPU from the emitters and the time (as the source look draws them): steam rising
// in puffs, drips falling off an edge, a flame's core and tongue, moths round a lamp. The pass lays them on the frame.
import { describe, expect, it } from 'vitest'
import { type Emitter, particleSprites } from '#src/features/sky/particle-sprites.ts'

const steam: Emitter = { kind: 'steam', at: [1, 0.5, 2] }

describe('particleSprites', () => {
  it('lifts steam in puffs that rise and spread: lighter low, darker and larger as they thin', () => {
    const sprites = particleSprites([steam], 0)
    expect(sprites.length).toBeGreaterThanOrEqual(4)
    for (const s of sprites) {
      expect(s.at[1]).toBeGreaterThanOrEqual(0.5)
      expect(s.at[1]).toBeLessThanOrEqual(0.5 + 1.6)
      expect([0xcdd2da, 0x848795]).toContain(s.colour)
    }
    const low = sprites.filter((s) => s.colour === 0xcdd2da)
    const high = sprites.filter((s) => s.colour === 0x848795)
    expect(Math.max(...low.map((s) => s.at[1]))).toBeLessThan(Math.min(...high.map((s) => s.at[1])) + 1e-9)
    expect(Math.max(...high.map((s) => s.radius))).toBeGreaterThan(Math.max(...low.map((s) => s.radius)))
  })

  it('moves the same way at the same time and on a new step 1/12 s on', () => {
    expect(particleSprites([steam], 0.3)).toEqual(particleSprites([steam], 0.3))
    expect(particleSprites([steam], 0.3)).toEqual(particleSprites([steam], 0.3 + 0.02))
    expect(particleSprites([steam], 0.3)).not.toEqual(particleSprites([steam], 0.3 + 1 / 12))
  })

  it('drops drips from along an edge to the ground, two sprites each, in the water’s blue', () => {
    const drip: Emitter = { kind: 'drip', at: [0, 2.5, 0], to: [2, 2.5, 0], ground: 0 }
    const sprites = particleSprites([drip], 0.2)
    expect(sprites).toHaveLength(12)
    for (const s of sprites) {
      expect(s.colour).toBe(0x88d6ff)
      expect(s.at[0]).toBeGreaterThanOrEqual(0)
      expect(s.at[0]).toBeLessThanOrEqual(2)
      expect(s.at[1]).toBeLessThanOrEqual(2.5 + 0.06)
      expect(s.radius).toBe(0)
    }
  })

  it('draws a flame as three sprites over one another: a hot core, a tongue, an orange body', () => {
    const sprites = particleSprites([{ kind: 'flame', at: [0, 1, 0] }], 0)
    expect(sprites.map((s) => s.colour)).toEqual([0xf99b4e, 0xffbc4e, 0xffe949])
    expect(sprites.map((s) => s.radius)).toEqual([1.2, 0.8, 0.4])
  })

  it('circles three moths round a lamp, dark, within a third of a metre of its axis', () => {
    const sprites = particleSprites([{ kind: 'moth', at: [3, 2.2, 1] }], 0.5)
    expect(sprites).toHaveLength(3)
    for (const s of sprites) {
      expect(s.colour).toBe(0x3c3151)
      expect(Math.hypot(s.at[0] - 3, s.at[2] - 1)).toBeLessThanOrEqual(0.4 + 1e-9)
    }
  })
})
