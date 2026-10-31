import { describe, expect, it } from 'vitest'
import { Distribution, NetDiagnostics } from './net-diagnostics'

// FloorFifty's `net-diagnostics.test.ts` (677d4568), generic: its race-specific cases (the sprite pull, respawn adoption, the
// `?netstats` address) stay in the arcade source. `degraded` is new here (M7 spec §4.2).

const make = (over: { time?: { now: number }; log?: string[] } = {}) => {
  const time = over.time ?? { now: 0 }
  const changes: boolean[] = []
  const d = new NetDiagnostics({ now: () => time.now, onDegraded: (b) => changes.push(b) })
  if (over.log) d.attach((line) => over.log?.push(line))
  return { d, time, changes }
}

describe('Distribution', () => {
  it('summarises the last values: count, last, min, median, p95, max', () => {
    const dist = new Distribution(100)
    for (let i = 1; i <= 100; i++) dist.add(i)
    expect(dist.summary()).toEqual({ count: 100, last: 100, min: 1, p50: 50, p95: 95, max: 100 })
  })
  it('keeps only its capacity, newest last', () => {
    const dist = new Distribution(3)
    for (const v of [1, 2, 3, 4, 5]) dist.add(v)
    expect(dist.summary()).toMatchObject({ count: 3, min: 3, max: 5, last: 5 })
  })
  it('is zeros while empty', () => {
    expect(new Distribution().summary()).toEqual({ count: 0, last: 0, min: 0, p50: 0, p95: 0, max: 0 })
  })
})

describe('snapshots', () => {
  it('separates republished and reordered snapshots from new ones, and times the gaps', () => {
    const { d, time } = make()
    d.snapshot(10)
    time.now = 50
    d.snapshot(13)
    time.now = 60
    d.snapshot(13)
    time.now = 70
    d.snapshot(12)
    const s = d.summary().snapshots
    expect(s).toMatchObject({ count: 4, duplicates: 1, reordered: 1 })
    expect(s.intervalMs.max).toBe(50)
    expect(s.tickStep.last).toBe(3)
  })
})

describe('the buffer', () => {
  it('counts a frame that sampled past the newest snapshot as an underrun', () => {
    const { d } = make()
    d.buffer(3)
    d.buffer(0)
    d.buffer(-2)
    expect(d.summary().buffer).toMatchObject({ frames: 3, underruns: 1 })
  })
})

describe('corrections', () => {
  it('keeps the size of a correction apart from how many were adopted outright', () => {
    const { d } = make()
    d.correction(0.4, false)
    d.correction(6, true)
    expect(d.summary().corrections).toMatchObject({ count: 2, adopted: 1 })
    expect(d.summary().corrections.size.max).toBe(6)
  })
})

describe('late commands and the clock', () => {
  it('counts commands resent late and clock jumps', () => {
    const { d } = make()
    d.lateCommand()
    d.lateCommand()
    d.clock({ error: 0.3, delayTicks: 4.5, snaps: 2 })
    expect(d.summary().input.lateCommands).toBe(2)
    expect(d.summary().clock).toMatchObject({ snaps: 2, delayTicks: 4.5 })
  })
})

describe('anomalies', () => {
  it('log only while someone listens, and once a second per kind', () => {
    const lines: string[] = []
    const quiet = make()
    quiet.d.correction(50, true)
    expect(lines).toEqual([])
    const { d, time } = make({ log: lines })
    d.correction(50, true)
    d.correction(60, true)
    time.now = 500
    d.correction(70, true)
    time.now = 1100
    d.correction(80, true)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('correction')
  })
})

describe('the wire', () => {
  it('turns a byte count into a rate', () => {
    const { d, time } = make()
    d.bytes(0)
    time.now = 2000
    d.bytes(10_000)
    expect(d.summary().wire).toEqual({ bytesIn: 10_000, bytesPerSecond: 5000 })
  })
})

describe('degraded', () => {
  it('is false on a healthy link', () => {
    const { d } = make()
    d.roundTrip(40)
    expect(d.degraded).toBe(false)
  })
  it('turns on when the round trip median passes the threshold and off below 80 % of it', () => {
    const { d, changes } = make()
    for (const rtt of [1200, 1300, 1100, 1250, 1400]) d.roundTrip(rtt)
    expect(d.degraded).toBe(true)
    for (const rtt of [900, 900, 900, 900, 900]) d.roundTrip(rtt)
    expect(d.degraded).toBe(true)
    for (const rtt of [700, 700, 700, 700, 700]) d.roundTrip(rtt)
    expect(d.degraded).toBe(false)
    expect(changes).toEqual([true, false])
  })
  it('turns on when snapshots stop arriving for the gap threshold, and off with the next one', () => {
    const { d, time, changes } = make()
    d.snapshot(1)
    time.now = 900
    d.poll()
    expect(d.degraded).toBe(false)
    time.now = 1500
    d.poll()
    expect(d.degraded).toBe(true)
    d.snapshot(40)
    expect(d.degraded).toBe(false)
    expect(changes).toEqual([true, false])
  })
  it('does not call a room degraded before its first snapshot', () => {
    const { d, time } = make()
    time.now = 60_000
    d.poll()
    expect(d.degraded).toBe(false)
  })
  it('takes its thresholds from the options', () => {
    const d = new NetDiagnostics({ now: () => 0, thresholds: { roundTripMs: 200, gapMs: 1000 } })
    for (const rtt of [300, 300, 300, 300, 300]) d.roundTrip(rtt)
    expect(d.degraded).toBe(true)
  })
})

describe('reset', () => {
  it('forgets everything, as leaving a room does', () => {
    const { d } = make()
    d.snapshot(1)
    d.lateCommand()
    d.reset()
    expect(d.summary().snapshots.count).toBe(0)
    expect(d.summary().input.lateCommands).toBe(0)
    expect(d.degraded).toBe(false)
  })
})
