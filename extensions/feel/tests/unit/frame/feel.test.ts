// `createFeel` (M6.1a step 4, M6 spec §4.1, F-a): sim events answered when the drawn tick reaches them, on each channel,
// clamped to the limits. A frame is a pure function of the events, the drawn tick, the settings and the frame times.
import { describe, expect, it } from 'vitest'
import type { Feel, FeelFrame } from '#src/features/frame/feel.ts'
import type { FeelContent } from '#src/shared/feel.schema.ts'
import { content, FRAME, frames, make, quiet, slam } from '#src/testing/feel-table.ts'

describe('F-a: events at the drawn tick', () => {
  it('a slam at tick 10 gives the same frames on every run, and its first non-empty frame is the one whose drawn tick reaches 10', () => {
    const run = (): FeelFrame[] => {
      const feel = make()
      feel.hear(10, [slam(7)])
      return frames(feel, 0, 60)
    }
    const a = run()
    expect(run()).toEqual(a)
    expect(a.findIndex((f) => !quiet(f))).toBe(10)
    expect(a.slice(0, 10).every(quiet)).toBe(true)
  })
  it('answers an event once, however often it is heard', () => {
    const feel = make()
    feel.hear(3, [slam(1)])
    feel.hear(3, [slam(1)])
    const all = frames(feel, 0, 5)
    expect(all.flatMap((f) => f.cues)).toEqual(['slam'])
  })
  it('drops an event the picture passed long ago, and answers one a moment behind', () => {
    const late = make()
    late.hear(0, [slam(1)])
    expect(late.frame(100, 0, FRAME).cues).toEqual([])
    const near = make()
    near.hear(90, [slam(1)])
    expect(near.frame(100, 0, FRAME).cues).toEqual(['slam'])
  })
  it('answers nothing for an event no entry names', () => {
    const feel = make()
    feel.hear(1, [{ type: 'unrelated', payload: {} }])
    expect(frames(feel, 0, 10).every(quiet)).toBe(true)
  })
  it('answers a pattern entry, and every entry that matches', () => {
    const feel = make()
    feel.hear(2, [
      { type: 'door.open', payload: {} },
      { type: 'door.shut', payload: {} },
    ])
    expect(frames(feel, 0, 4).flatMap((f) => f.cues)).toEqual(['creak', 'creak'])
  })
})

describe('the channels', () => {
  const at = (feel: Feel, drawn: number, after = 0): FeelFrame => {
    let f = feel.frame(drawn, 0, FRAME)
    for (let i = 0; i < after; i += 1) f = feel.frame(drawn, 0, FRAME)
    return f
  }
  it('the frame the slam lands on carries its cue, rumble, flash, tint, word, squash, freeze and shake', () => {
    const feel = make()
    feel.hear(0, [slam(7)])
    const f = at(feel, 0)
    expect(f.cues).toEqual(['slam'])
    expect(f.haptics).toEqual([{ strong: 0.6, weak: 0.4, ms: 90, phoneMs: 18 }])
    expect(f.flash).toEqual({ colour: 'white', alpha: 0.85 })
    expect(f.tint).toMatchObject({ colour: 'red' })
    expect(f.words).toEqual([{ key: 'feel.word.slam', at: 7, age: 0, still: false }])
    expect(f.frozen).toEqual([7])
    expect([...f.squash.keys()]).toEqual([7])
    expect(f.squash.get(7)?.[0]).toBeGreaterThan(1)
    expect(f.squash.get(7)?.[1]).toBeLessThan(1)
    // The haptic and the cue fire once, on that frame only.
    expect(at(feel, 1).cues).toEqual([])
    expect(at(feel, 1).haptics).toEqual([])
  })
  it('shakes in whole pixels within the limit, and settles back to nothing', () => {
    const feel = make()
    feel.hear(0, [slam(7)])
    const all = frames(feel, 0, 120)
    for (const f of all) {
      expect(Number.isInteger(f.offset[0]) && Number.isInteger(f.offset[1])).toBe(true)
      expect(Math.abs(f.offset[0])).toBeLessThanOrEqual(3)
      expect(Math.abs(f.offset[1])).toBeLessThanOrEqual(3)
    }
    expect(all.some((f) => f.offset[0] !== 0 || f.offset[1] !== 0)).toBe(true)
    expect(all.at(-1)?.offset).toEqual([0, 0])
  })
  it('holds a freeze for its milliseconds, clamped to the limit, then lets go', () => {
    const feel = make()
    feel.hear(0, [slam(7)])
    const all = frames(feel, 0, 20)
    const frozenFrames = all.filter((f) => f.frozen.includes(7)).length
    // 90 ms at 60 Hz is 5 or 6 frames.
    expect(frozenFrames).toBeGreaterThanOrEqual(5)
    expect(frozenFrames).toBeLessThanOrEqual(6)
    const long = make({
      content: () => ({ ...content, entry: [{ on: 'slam', pose: [{ hit_stop_ms: 9000 }] }] }),
    })
    long.hear(0, [slam(7)])
    expect(frames(long, 0, 30).filter((f) => f.frozen.includes(7)).length).toBeLessThanOrEqual(8)
  })
  it('holds a flash for its frames, clamped to the limit and its alpha to the limit', () => {
    const wild = make({
      content: () => ({
        ...content,
        entry: [{ on: 'slam', visual: [{ flash: 'white', frames: 99, alpha: 1 }] }],
      }),
    })
    wild.hear(0, [slam(7)])
    const all = frames(wild, 0, 10)
    expect(all.filter((f) => f.flash !== null).length).toBeLessThanOrEqual(3)
    expect(all[0]?.flash?.alpha).toBe(0.85)
  })
  it('draws a flash at least once, however slow the frame it lands on is', () => {
    const feel = make({
      content: () => ({ ...content, entry: [{ on: 'slam', visual: [{ flash: 'white', frames: 1 }] }] }),
    })
    feel.hear(0, [slam(7)])
    // A frame a quarter of a second long (4 fps) is longer than the whole flash; the flash is still drawn, then gone.
    expect(feel.frame(0, 0, 0.25).flash).not.toBeNull()
    expect(feel.frame(1, 0, 0.25).flash).toBeNull()
  })
  it('steps a tint down to nothing over its time, and a word lives its time then goes', () => {
    const feel = make()
    feel.hear(0, [slam(7)])
    const all = frames(feel, 0, 60)
    const alphas = all.map((f) => f.tint?.alpha ?? 0)
    expect(alphas[0]).toBeCloseTo(0.4, 6)
    expect(Math.max(...alphas.slice(30))).toBeLessThan(alphas[0] as number)
    expect(all[10]?.words).toHaveLength(1)
    expect(all[10]?.words[0]?.age).toBeGreaterThan(0)
    expect(all[59]?.words).toHaveLength(0)
  })
  it('settles a squash back to rest, drawn on 1/32 steps', () => {
    const feel = make()
    feel.hear(0, [slam(7)])
    const all = frames(feel, 0, 200)
    for (const f of all) for (const [x] of f.squash.values()) expect((x * 32) % 1).toBeCloseTo(0, 6)
    expect(all.at(-1)?.squash.size).toBe(0)
  })
  it('reads the content live: an edit shows on the next event (a reload, M6.1c)', () => {
    let table: FeelContent = content
    const feel = make({ content: () => table })
    feel.hear(0, [slam(7)])
    expect(feel.frame(0, 0, FRAME).cues).toEqual(['slam'])
    table = { ...content, entry: [{ on: 'slam', audio: [{ cue: 'thud' }] }] }
    feel.hear(5, [slam(7)])
    expect(frames(feel, 1, 5).flatMap((f) => f.cues)).toEqual(['thud'])
  })
  it('takes an event with no subject: its view channels have nothing to act on, the rest answer', () => {
    const feel = make()
    feel.hear(0, [slam()])
    const f = feel.frame(0, 0, FRAME)
    expect(f.frozen).toEqual([])
    expect(f.squash.size).toBe(0)
    expect(f.cues).toEqual(['slam'])
    expect(f.words[0]?.at).toBeNull()
  })
})
