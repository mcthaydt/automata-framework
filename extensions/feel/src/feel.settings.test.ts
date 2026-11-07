// The player's switches (M6.1a step 5, M6 spec §4.1, F-c): reduced motion, reduce flashing, intensity and the rumble switch,
// each read live on every frame, so a change applies on the next one without a remount.
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type FeelSettings } from './feel'
import { FRAME, frames, make, quiet, slam } from './testing/feel-table'

describe('F-c: reduced motion', () => {
  it('gives an offset of [0, 0], freezes no view, leaves every squash at rest, and shows words still', () => {
    const feel = make({ reducedMotion: () => true })
    feel.hear(0, [slam(7)])
    const all = frames(feel, 0, 60)
    for (const f of all) {
      expect(f.offset).toEqual([0, 0])
      expect(f.frozen).toEqual([])
      expect(f.squash.size).toBe(0)
    }
    expect(all[0]?.words).toEqual([{ key: 'feel.word.slam', at: 7, age: 0, still: true }])
    // What is not motion stays: the flash, the cue and the rumble.
    expect(all[0]?.flash).not.toBeNull()
    expect(all[0]?.cues).toEqual(['slam'])
    expect(all[0]?.haptics).toHaveLength(1)
  })
  it('applies on the next frame when it is switched on mid-shake, and the shake does not come back when it is off again', () => {
    let still = false
    const feel = make({ reducedMotion: () => still })
    feel.hear(0, [slam(7)])
    const first = frames(feel, 0, 2)
    expect(first.some((f) => f.frozen.includes(7) || f.squash.size > 0)).toBe(true)
    still = true
    const stopped = feel.frame(3, 0, FRAME)
    expect(stopped.offset).toEqual([0, 0])
    expect(stopped.frozen).toEqual([])
    expect(stopped.squash.size).toBe(0)
    still = false
    expect(feel.frame(4, 0, FRAME).squash.size).toBe(0)
  })
})

describe('F-c: reduce flashing', () => {
  it('has no frame with a flash', () => {
    const feel = make({ settings: () => ({ ...DEFAULT_SETTINGS, reduceFlashing: true }) })
    feel.hear(0, [slam(7)])
    expect(frames(feel, 0, 30).every((f) => f.flash === null)).toBe(true)
  })
  it('takes a flash away on the next frame when it is switched on, and leaves the tint', () => {
    let settings: FeelSettings = DEFAULT_SETTINGS
    const feel = make({ settings: () => settings })
    feel.hear(0, [slam(7)])
    expect(feel.frame(0, 0, FRAME).flash).not.toBeNull()
    settings = { ...DEFAULT_SETTINGS, reduceFlashing: true }
    const next = feel.frame(1, 0, FRAME)
    expect(next.flash).toBeNull()
    expect(next.tint).not.toBeNull()
  })
})

describe('intensity', () => {
  it('0 drops the camera and pose effects and keeps flash, words, rumble and cues', () => {
    const feel = make({ settings: () => ({ ...DEFAULT_SETTINGS, intensity: 0 }) })
    feel.hear(0, [slam(7)])
    const all = frames(feel, 0, 30)
    expect(
      all.every(
        (f) => f.offset[0] === 0 && f.offset[1] === 0 && f.frozen.length === 0 && f.squash.size === 0,
      ),
    ).toBe(true)
    expect(all[0]?.flash).not.toBeNull()
    expect(all[0]?.words).toHaveLength(1)
    expect(all[0]?.haptics).toHaveLength(1)
    expect(all[0]?.cues).toEqual(['slam'])
  })
  it('0.5 holds a freeze for half as long and knocks a squash half as far', () => {
    const run = (intensity: 0 | 0.5 | 1) => {
      const feel = make({ settings: () => ({ ...DEFAULT_SETTINGS, intensity }) })
      feel.hear(0, [slam(7)])
      const all = frames(feel, 0, 20)
      return { frozen: all.filter((f) => f.frozen.length > 0).length, x: all[0]?.squash.get(7)?.[0] ?? 1 }
    }
    const full = run(1)
    const half = run(0.5)
    expect(half.frozen).toBeLessThan(full.frozen)
    expect(half.frozen).toBeGreaterThan(0)
    expect(half.x - 1).toBeCloseTo((full.x - 1) / 2, 1)
  })
})

describe('haptics', () => {
  it('off, a slam fires no rumble; on, it fires one', () => {
    const off = make({ settings: () => ({ ...DEFAULT_SETTINGS, haptics: false }) })
    off.hear(0, [slam(7)])
    expect(off.frame(0, 0, FRAME).haptics).toEqual([])
    const on = make()
    on.hear(0, [slam(7)])
    expect(on.frame(0, 0, FRAME).haptics).toHaveLength(1)
  })
  it('is not motion: reduced motion leaves the rumble alone', () => {
    const feel = make({ reducedMotion: () => true })
    feel.hear(0, [slam(7)])
    expect(feel.frame(0, 0, FRAME).haptics).toHaveLength(1)
  })
})

describe('a quiet feel', () => {
  it('has nothing to say before any event', () => {
    expect(frames(make(), 0, 30).every(quiet)).toBe(true)
  })
})
