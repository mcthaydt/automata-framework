import { describe, expect, it } from 'vitest'
import { AuthorityClock } from '#src/features/client/interpolation/authority-clock.ts'

// The authority half of FloorFifty's `RenderClock` (677d4568 `render-clock.ts`): where the room is now, on one clock
// that runs on rendered time and that snapshots only steer. The drawn moment (the interpolation delay) is M7.5c's.

const TICK_MS = 1000 / 60
/** A clock on virtual time: the sum of frame deltas, as a test that draws frames means by time. */
const clock = (): AuthorityClock => new AuthorityClock({ tickHz: 60 })

describe('the authority clock', () => {
  it('knows nothing before the first snapshot', () => {
    const subject = clock()
    expect(subject.advance(TICK_MS)).toBeUndefined()
    expect(subject.authorityTick()).toBeUndefined()
    expect(subject.error).toBe(0)
  })

  it('starts at the first snapshot and runs at the nominal rate between snapshots', () => {
    const subject = clock()
    subject.observe(30)
    expect(subject.authorityTick()).toBe(30)
    for (let frame = 0; frame < 10; frame += 1) subject.advance(TICK_MS)
    expect(subject.authorityTick()).toBeCloseTo(40, 9)
    expect(subject.error).toBeCloseTo(0, 9)
  })

  it('eases toward a later anchor by at most a tenth of elapsed time, and never past it', () => {
    const subject = clock()
    subject.observe(30)
    // Arrives two ticks ahead of where the clock has authority.
    subject.observe(32)
    expect(subject.error).toBeCloseTo(2, 9)
    subject.advance(TICK_MS)
    // One tick of nominal time, plus at most a tenth of a tick of correction.
    expect(subject.authorityTick()).toBeCloseTo(31.1, 9)
    for (let frame = 0; frame < 200; frame += 1) subject.advance(TICK_MS)
    // Bled off exponentially (5% of the error per tick), so it is closed to well under a thousandth of a tick.
    expect(subject.error).toBeCloseTo(0, 3)
  })

  it('snaps forward to a snapshot far ahead', () => {
    const subject = clock()
    subject.observe(30)
    subject.observe(630)
    subject.advance(TICK_MS)
    expect(subject.authorityTick()).toBeCloseTo(631, 9)
    // Forward is not a restart.
    expect(subject.takeRestart()).toBe(false)
  })

  it('does not move back for one snapshot far behind, but does after half a second of them', () => {
    const subject = clock()
    subject.observe(300)
    subject.observe(30)
    subject.advance(TICK_MS)
    // Ran on at the nominal rate: one late delivery proves nothing.
    expect(subject.authorityTick()).toBeCloseTo(301, 9)
    for (let frame = 0; frame < 40; frame += 1) {
      subject.observe(31 + frame)
      subject.advance(TICK_MS)
    }
    expect(subject.authorityTick()).toBeLessThan(100)
    // Said once, so the prediction can follow the restart.
    expect(subject.takeRestart()).toBe(true)
    expect(subject.takeRestart()).toBe(false)
  })

  it('anchors a snapshot at the time it arrived, not the time it is read', () => {
    let now = 0
    const subject = new AuthorityClock({ tickHz: 60, now: () => now })
    subject.observe(30, 0)
    now = 10 * TICK_MS
    // Arrived at 0 though read ten ticks later: authority is 60 now, far enough ahead to snap to. Anchored at the
    // read instead it would say 50, which the clock (at 40) would only ease toward.
    subject.observe(50, 0)
    subject.advance(0)
    expect(subject.authorityTick()).toBeCloseTo(60, 9)
  })

  it('forgets everything on clear', () => {
    const subject = clock()
    subject.observe(30)
    subject.advance(TICK_MS)
    subject.clear()
    expect(subject.authorityTick()).toBeUndefined()
    expect(subject.advance(TICK_MS)).toBeUndefined()
  })
})
