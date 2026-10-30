import { describe, expect, it } from 'vitest'
import type { FigureClipDef } from './clip.schema'
import { clipTime, markerTime, retime, smoothTime, stepTime } from './clip-time'

const clip = (loop: FigureClipDef['loop']): FigureClipDef => ({
  length: 0.5,
  loop,
  mask: ['armR'],
  keys: [
    { t: 0, pose: 'stand' },
    { t: 0.2, pose: 'guard-high' },
    { t: 0.5, pose: 'stand' },
  ],
  markers: { windup: 0.1, contact: 0.32 },
  cues: [{ t: 0.3, id: 'swing' }],
})

describe('clipTime', () => {
  it('clamps once and hold to the clip', () => {
    for (const loop of ['once', 'hold'] as const) {
      expect(clipTime(clip(loop), -1)).toBe(0)
      expect(clipTime(clip(loop), 0.3)).toBe(0.3)
      expect(clipTime(clip(loop), 7)).toBe(0.5)
    }
  })
  it('wraps a loop, so its end is its start', () => {
    expect(clipTime(clip('loop'), 0.5)).toBe(0)
    expect(clipTime(clip('loop'), 1.25)).toBeCloseTo(0.25, 12)
    expect(clipTime(clip('loop'), -0.2)).toBe(0)
  })
  it('runs a pingpong forward then back', () => {
    expect(clipTime(clip('pingpong'), 0.3)).toBeCloseTo(0.3, 12)
    expect(clipTime(clip('pingpong'), 0.5)).toBeCloseTo(0.5, 12)
    expect(clipTime(clip('pingpong'), 0.7)).toBeCloseTo(0.3, 12)
    expect(clipTime(clip('pingpong'), 1.0)).toBeCloseTo(0, 12)
    expect(clipTime(clip('pingpong'), 1.1)).toBeCloseTo(0.1, 12)
  })
})

describe('stepTime', () => {
  const c = clip('once')
  it('floors to the pose step at the rate', () => {
    expect(stepTime(c, 0.05, 12)).toBe(0)
    expect(stepTime(c, 0.09, 12)).toBeCloseTo(1 / 12, 12)
    expect(stepTime(c, 0.2, 12)).toBeCloseTo(2 / 12, 12)
  })
  it('shows a marker from its instant to the end of its step, never before it', () => {
    // The step from 0.25 to 0.333… holds contact (0.32).
    expect(stepTime(c, 0.3, 12)).toBeCloseTo(0.25, 12)
    expect(stepTime(c, 0.31999, 12)).toBeCloseTo(0.25, 12)
    expect(stepTime(c, 0.32, 12)).toBe(0.32)
    expect(stepTime(c, 0.333, 12)).toBe(0.32)
    expect(stepTime(c, 0.34, 12)).toBeCloseTo(4 / 12, 12)
  })
  it('refuses a rate that is not positive', () => {
    expect(() => stepTime(c, 0.1, 0)).toThrow(RangeError)
  })
})

describe('retime', () => {
  it('scales keys, markers and cues evenly, the last key landing on the length', () => {
    const c = clip('once')
    const long = retime(c, 0.8)
    const k = 0.8 / 0.5
    expect(long.length).toBe(0.8)
    expect(long.keys.map((key) => key.t)).toEqual([0, 0.2 * k, 0.8])
    expect(long.markers).toEqual({ windup: 0.1 * k, contact: 0.32 * k })
    expect(long.cues).toEqual([{ t: 0.3 * k, id: 'swing' }])
    expect(long.keys.map((key) => key.pose)).toEqual(c.keys.map((key) => key.pose))
    expect(c.length).toBe(0.5)
  })
  it('refuses a length that is not a positive finite number', () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => retime(clip('once'), bad)).toThrow(RangeError)
  })
})

describe('markerTime', () => {
  it("reads a marker's time and refuses a missing one by name", () => {
    expect(markerTime(clip('once'), 'contact')).toBe(0.32)
    expect(() => markerTime(clip('once'), 'impact')).toThrow(/impact/)
  })
})

describe('smoothTime', () => {
  const c = clip('once')
  it('is t itself, except that the first frame past a marker shows the marker', () => {
    expect(smoothTime(c, 0.3, 0.29)).toBe(0.3)
    expect(smoothTime(c, 0.33, 0.31)).toBe(0.32)
    expect(smoothTime(c, 0.32, 0.31)).toBe(0.32)
    // The frame after shows its own time.
    expect(smoothTime(c, 0.35, 0.33)).toBe(0.35)
  })
  it('shows the first frame (no previous) at its own time', () => {
    expect(smoothTime(c, 0.1, undefined)).toBe(0.1)
  })
})
