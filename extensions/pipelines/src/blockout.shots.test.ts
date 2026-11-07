import { expand } from '@mcthaydt/automata-sector-format/blockout'
import { describe, expect, it } from 'vitest'
import { DEFAULT_LEGIBLE, judge, luminanceStats, standingPoints, zoneAt } from './blockout.shots.ts'
import type { PngImage } from './png.ts'
import { TOY } from './testing/toy-blockout.ts'

// The shots stage's pure parts (M6 spec §4.11): which zone a point is in, where to stand for each camera zone, and whether a grey shot is
// legible (its luminance mean and the spread between its 10th and 90th percentiles).

const TWO_ZONES = {
  ...TOY,
  zones: [
    { id: 'a', look: [3.5, 1, 2] as [number, number, number], distance: 14 },
    {
      id: 'b',
      look: [5.5, 1, 2] as [number, number, number],
      distance: 12,
      area: { x: [4.1, null] as [number, null] },
    },
  ],
}

describe('zoneAt', () => {
  const zones = TWO_ZONES.zones
  it('is the first zone for the rest of the map, and a later zone inside its area (exclusive bounds)', () => {
    expect(zoneAt(zones, { x: 1, z: 1 })).toBe('a')
    expect(zoneAt(zones, { x: 5, z: 1 })).toBe('b')
    expect(zoneAt(zones, { x: 4.1, z: 1 })).toBe('a')
  })
  it('lets a later zone win where areas overlap', () => {
    const nested = [
      ...zones,
      {
        id: 'c',
        look: [0, 0, 0] as [number, number, number],
        distance: 5,
        area: { x: [6, null] as [number, null] },
      },
    ]
    expect(zoneAt(nested, { x: 6.5, z: 1 })).toBe('c')
    expect(zoneAt(nested, { x: 5, z: 1 })).toBe('b')
  })
})

describe('standingPoints', () => {
  it('stands each zone at the spawn or the first nav node inside it, facing as the spawn faces', () => {
    const x = expand(TWO_ZONES)
    const { points, skipped } = standingPoints(TWO_ZONES, x)
    expect(skipped).toEqual([])
    expect(points[0]).toEqual({ zone: 'a', place: [1, 1, 0] })
    expect(points[1]?.zone).toBe('b')
    expect((points[1]?.place[0] as number) > 4.1).toBe(true)
  })
  it('skips a zone with no spawn or nav node inside it, and lists it', () => {
    const empty = {
      ...TWO_ZONES,
      zones: [
        ...TWO_ZONES.zones,
        {
          id: 'far',
          look: [0, 0, 0] as [number, number, number],
          distance: 5,
          area: { x: [50, null] as [number, null] },
        },
      ],
    }
    const { points, skipped } = standingPoints(empty, expand(empty))
    expect(points.map((p) => p.zone)).toEqual(['a', 'b'])
    expect(skipped).toEqual(['far'])
  })
})

const grey = (values: number[], channels: 1 | 3 | 4 = 1): PngImage => ({
  width: values.length,
  height: 1,
  channels,
  data: Uint8Array.from(
    values.flatMap((v) => Array.from({ length: channels }, (_, c) => (channels === 4 && c === 3 ? 255 : v))),
  ),
})

describe('luminanceStats', () => {
  it('is the mean and the 10th to 90th percentile spread of the luminance', () => {
    const image = grey(Array.from({ length: 101 }, (_, i) => i * 2))
    const stats = luminanceStats(image)
    expect(stats.mean).toBeCloseTo(100, 5)
    expect(stats.spread).toBeCloseTo(160, 0)
  })
  it('weights colour channels as luminance (green counts most), and ignores alpha', () => {
    const red: PngImage = { width: 1, height: 1, channels: 4, data: Uint8Array.of(255, 0, 0, 255) }
    const green: PngImage = { width: 1, height: 1, channels: 4, data: Uint8Array.of(0, 255, 0, 255) }
    expect(luminanceStats(green).mean).toBeGreaterThan(luminanceStats(red).mean)
    expect(luminanceStats(red).mean).toBeCloseTo(0.2126 * 255, 3)
  })
})

describe('judge', () => {
  it('calls a mid-grey shot with some spread legible', () => {
    expect(judge({ mean: 120, spread: 80 }, DEFAULT_LEGIBLE)).toBe(true)
  })
  it('refuses one too dark, too bright or too flat', () => {
    expect(judge({ mean: 20, spread: 80 }, DEFAULT_LEGIBLE)).toBe(false)
    expect(judge({ mean: 240, spread: 80 }, DEFAULT_LEGIBLE)).toBe(false)
    expect(judge({ mean: 120, spread: 5 }, DEFAULT_LEGIBLE)).toBe(false)
  })
  it('takes its bounds from the spec', () => {
    expect(judge({ mean: 20, spread: 10 }, { mean: [10, 30], spread: 5 })).toBe(true)
  })
})
