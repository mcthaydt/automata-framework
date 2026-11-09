import { describe, expect, it } from 'vitest'
import { picture } from '#src/features/audio/audio-picture.ts'

describe('the picture of a sound', () => {
  it('puts a tone across the part of the sound it lasts, rising when it ends higher', () => {
    const bars = picture(
      {
        id: 'a',
        bus: 'sfx',
        voices: [
          { tone: 'sine', from: 200, to: 800, length: 0.5, volume: 0.5 },
          { tone: 'sine', from: 800, to: 200, at: 0.5, length: 0.5, volume: 0.5 },
        ],
      },
      200,
      100,
    )
    expect(bars).toHaveLength(2)
    const [rise, fall] = bars
    expect(rise).toMatchObject({ kind: 'tone', x: 0, w: 100 })
    expect(rise?.y1).toBeLessThan(rise?.y0 ?? 0)
    expect(fall).toMatchObject({ kind: 'tone', x: 100, w: 100 })
    expect(fall?.y1).toBeGreaterThan(fall?.y0 ?? 0)
  })

  it('puts pitch on a log scale from 50 Hz at the bottom to 8 kHz at the top, and keeps it inside', () => {
    const [low, high, outside] = picture(
      {
        id: 'a',
        bus: 'sfx',
        voices: [
          { tone: 'sine', from: 50, to: 50, length: 1, volume: 1 },
          { tone: 'sine', from: 8000, to: 8000, length: 1, volume: 1 },
          { tone: 'sine', from: 20000, to: 10, length: 1, volume: 1 },
        ],
      },
      100,
      100,
    )
    expect(low?.y0).toBeCloseTo(100)
    expect(high?.y0).toBeCloseTo(0)
    expect(outside?.y0).toBeGreaterThanOrEqual(0)
    expect(outside?.y1).toBeLessThanOrEqual(100)
  })

  it('draws a hiss as a band, wider for a range of pitches', () => {
    const [one, range] = picture(
      {
        id: 'a',
        bus: 'sfx',
        voices: [
          { hiss: 2000, q: 1, length: 1, volume: 1 },
          { hiss: [400, 4000], q: 1, length: 1, volume: 1 },
        ],
      },
      100,
      100,
    )
    expect(one?.kind).toBe('hiss')
    const thick = (bar: typeof one): number => Math.abs((bar?.y1 ?? 0) - (bar?.y0 ?? 0))
    expect(thick(range)).toBeGreaterThan(thick(one))
  })

  it('draws nothing for a sound with no voices', () => {
    expect(picture({ id: 'a', bus: 'sfx', voices: [] }, 100, 100)).toEqual([])
  })
})
