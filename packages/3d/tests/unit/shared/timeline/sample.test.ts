// The timeline every keyed thing shares (spec 8.3): keys with eases, tracks of them, and a sampling that is pure.
// Ported from the environment source's keyframe tests and the figures' clip sampling, one set for both.

import { describe, expect, it } from 'vitest'
import { easeAt, easeSchema, parseEase } from '#src/shared/timeline/ease.ts'
import { type Mix, mixNumber, sample } from '#src/shared/timeline/sample.ts'
import { type Track, track, wrapTime } from '#src/shared/timeline/track.ts'

/** `sample` on a copy of the track: the answer must not depend on anything sampled before it. */
const sampleFresh = <V>(keys: Track<V>, t: number, mix: Mix<V>): V | undefined =>
  sample(
    keys.map((key) => ({ ...key })),
    t,
    mix,
  )

describe('sample', () => {
  it('holds the first value before the first key and the last after the last', () => {
    expect(
      sample(
        track([
          [0, 1],
          [1, 3],
        ]),
        -1,
        mixNumber,
      ),
    ).toBe(1)
    expect(
      sample(
        track([
          [0, 1],
          [1, 3],
        ]),
        2,
        mixNumber,
      ),
    ).toBe(3)
  })
  it('blends linearly between keys when no ease is named', () => {
    expect(
      sample(
        track([
          [0, 0],
          [2, 10],
        ]),
        0.5,
        mixNumber,
      ),
    ).toBe(2.5)
  })
  it('eases into a key with that key’s own ease', () => {
    const tr = track([
      [0, 0],
      [1, 10, 'smooth'],
    ])
    expect(sample(tr, 0.5, mixNumber)).toBeCloseTo(5, 12)
    expect(sample(tr, 0.25, mixNumber)).toBeCloseTo(10 * easeAt('smooth', 0.25), 12)
  })
  it('a frame at t is the same drawn alone', () => {
    const tr = track([
      [0, 0, 'smooth'],
      [2, 10],
    ])
    for (const t of [0, 0.4, 1.3, 1.99, 2, 7])
      expect(sample(tr, t, mixNumber)).toBe(sampleFresh(tr, t, mixNumber))
  })
  it('sorts keys by time, keeping the order of keys at the same time', () => {
    const tr = track([
      [1, 'b'],
      [0, 'a'],
      [1, 'c'],
    ])
    expect(tr.map((k) => k.value)).toEqual(['a', 'b', 'c'])
  })
  it('a stepped track holds the earlier value until the key', () => {
    const tr = track([
      [0, 'dark'],
      [1, 'lit', 'step'],
    ])
    expect(sample(tr, 0.99, (a) => a)).toBe('dark')
    expect(sample(tr, 1, (a) => a)).toBe('lit')
  })
  it('has no value for a track with no keys', () => {
    expect(sample(track<number>([]), 1, mixNumber)).toBeUndefined()
  })
})

describe('ease', () => {
  it('reads hold as step', () => expect(parseEase('hold')).toBe('step'))
  it('keeps a cubic-bezier ease', () => expect(parseEase([0.4, 0, 0.2, 1])).toEqual([0.4, 0, 0.2, 1]))
  it('has smooth, the smoothstep', () => {
    expect(easeAt('smooth', 0.5)).toBe(0.5)
    expect(easeAt('smooth', 0.25)).toBeCloseTo(0.15625, 12)
  })
  it('refuses a name it does not know, saying which', () => {
    expect(() => parseEase('bouncy')).toThrow(/bouncy/)
    expect(easeSchema.safeParse('bouncy').success).toBe(false)
  })
})

describe('wrapTime', () => {
  it('clamps once and hold, wraps loop and bounces pingpong', () => {
    expect(wrapTime('once', 2, 5)).toBe(2)
    expect(wrapTime('hold', 2, 5)).toBe(2)
    expect(wrapTime('loop', 2, 5)).toBe(1)
    expect(wrapTime('pingpong', 2, 3)).toBe(1)
    expect(wrapTime('pingpong', 2, 5)).toBe(1)
    expect(wrapTime('loop', 2, -1)).toBe(0)
  })
})
