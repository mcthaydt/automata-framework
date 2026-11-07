import { describe, expect, it } from 'vitest'
import { RenderClock } from '#src/features/client/interpolation/render-clock.ts'

// The interpolation half of FloorFifty's `RenderClock` (677d4568 `render-clock.ts`, tests `render-clock.test.ts`): the drawn moment
// is authority minus a delay that adapts to how late snapshots arrive. The authority half is `authority-clock.test.ts`.

const FRAME_MS = 1000 / 60
const BASE = 4.5
const MAX = 15
const make = (): RenderClock => new RenderClock({ tickHz: 60, snapshotTicks: 3, baseDelayTicks: BASE })

describe('before any authority has arrived', () => {
  it('has no moment to draw', () => {
    expect(make().advance(FRAME_MS)).toBeUndefined()
    expect(make().current()).toBeUndefined()
    expect(make().authorityTick()).toBeUndefined()
  })
})

describe('the first authority tick', () => {
  it('places the clock an interpolation delay behind it', () => {
    const clock = make()
    clock.observe(30)
    expect(clock.advance(0)).toBeCloseTo(30 - BASE)
  })
})

describe('between two authority snapshots', () => {
  it('advances with rendered time rather than holding still', () => {
    const clock = make()
    clock.observe(30)
    const first = clock.advance(FRAME_MS) as number
    expect(clock.advance(FRAME_MS)).toBeGreaterThan(first)
  })

  it('advances at the nominal rate while authority keeps pace', () => {
    const clock = make()
    clock.observe(30)
    const start = clock.advance(0) as number
    for (let frame = 0; frame < 3; frame += 1) clock.advance(FRAME_MS)
    clock.observe(33)
    expect((clock.advance(0) as number) - start).toBeCloseTo(3, 1)
  })
})

describe('reading the clock without advancing it', () => {
  it('reports the moment being drawn without moving it', () => {
    const clock = make()
    clock.observe(30)
    clock.advance(FRAME_MS)
    const drawn = clock.current()
    expect(clock.current()).toBe(drawn)
  })
})

describe('where authority is on this same clock', () => {
  it('undoes the interpolation delay the drawn moment carries', () => {
    const clock = make()
    clock.observe(30)
    clock.advance(FRAME_MS)
    expect((clock.authorityTick() as number) - (clock.current() as number)).toBeCloseTo(BASE, 9)
  })
})

describe('leaving the room', () => {
  it('forgets the moment and the widened delay, so a later room does not resume them', () => {
    const clock = make()
    clock.observe(30)
    clock.advance(FRAME_MS)
    clock.clear()
    expect(clock.current()).toBeUndefined()
    expect(clock.interpolationDelay).toBe(BASE)
    clock.observe(300)
    expect(clock.advance(0)).toBeCloseTo(300 - BASE)
  })
})

describe('a snapshot republished at a tick already seen', () => {
  it('does not drag the clock back', () => {
    const clock = make()
    clock.observe(30)
    for (let frame = 0; frame < 30; frame += 1) clock.advance(FRAME_MS)
    const before = clock.current() as number
    clock.observe(30)
    expect(clock.advance(0)).toBeCloseTo(before, 9)
  })
})

describe('the interpolation delay on a jittery link', () => {
  /** Snapshots every three ticks, each arriving up to `jitterFrames` late. */
  function run(jitterFrames: (index: number) => number, seconds: number, clock = make()) {
    let tick = 0
    clock.observe(0)
    const pending: { at: number; tick: number }[] = []
    const delays: number[] = []
    const authorities: number[] = []
    for (let frame = 0; frame < 60 * seconds; frame += 1) {
      if (frame % 3 === 0) {
        tick += 3
        pending.push({ at: frame + jitterFrames(frame / 3), tick })
      }
      while (pending.length > 0 && (pending[0] as { at: number }).at <= frame)
        clock.observe((pending.shift() as { tick: number }).tick)
      clock.advance(FRAME_MS)
      delays.push(clock.interpolationDelay)
      authorities.push(clock.authorityTick() as number)
    }
    return { clock, delays, authorities }
  }
  const late = (index: number): number => (index % 4 === 0 ? 3 : 0)

  it('stays at the base delay on a steady link', () => {
    expect(run(() => 0, 5).clock.interpolationDelay).toBeCloseTo(BASE, 9)
  })

  it('draws the others further back when snapshots run late, within its bound and slewed', () => {
    const { clock, delays } = run(late, 5)
    expect(clock.interpolationDelay).toBeGreaterThan(BASE + 2)
    expect(Math.max(...delays)).toBeLessThanOrEqual(MAX)
    for (let i = 1; i < delays.length; i += 1)
      expect(Math.abs((delays[i] as number) - (delays[i - 1] as number))).toBeLessThanOrEqual(0.05 + 1e-9)
  })

  it('never moves authority to do it, so the input timeline is untouched', () => {
    const steady = run(() => 0, 5)
    const jittery = run(late, 5)
    const last = (v: number[]): number => v[v.length - 1] as number
    expect(Math.abs(last(jittery.authorities) - last(steady.authorities))).toBeLessThan(1.5)
  })

  it('returns to the base delay once the link steadies', () => {
    const clock = make()
    run(late, 5, clock)
    const widened = clock.interpolationDelay
    let tick = Math.round(clock.authorityTick() as number)
    for (let frame = 0; frame < 60 * 8; frame += 1) {
      if (frame % 3 === 0) {
        tick += 3
        clock.observe(tick)
      }
      clock.advance(FRAME_MS)
    }
    expect(clock.interpolationDelay).toBeLessThan(widened)
    expect(clock.interpolationDelay).toBeCloseTo(BASE, 1)
  })
})

describe('a jump of the clock', () => {
  it('forgets the arrivals measured before it', () => {
    const clock = make()
    const out = (() => {
      let tick = 0
      clock.observe(0)
      for (let frame = 0; frame < 60 * 4; frame += 1) {
        if (frame % 3 === 0) {
          tick += 3
          clock.observe(tick - (frame % 12 === 0 ? 3 : 0))
        }
        clock.advance(FRAME_MS)
      }
      return clock.interpolationDelay
    })()
    expect(out).toBeGreaterThanOrEqual(BASE)
    // A resumed tab: the next snapshot is seconds ahead; the clock snaps and the old arrivals no longer count.
    clock.observe(Math.round(clock.authorityTick() as number) + 600)
    clock.advance(FRAME_MS)
    expect(clock.snaps).toBe(1)
  })
})
