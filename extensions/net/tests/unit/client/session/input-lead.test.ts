import { describe, expect, it } from 'vitest'
import {
  INITIAL_LEAD_TICKS,
  InputLead,
  leadForRoundTrip,
  MAX_LEAD_TICKS,
} from '#src/features/client/session/input-lead.ts'

// The input lead's constants are options; at 60 Hz with net's default `maxLeadTicks` (60) they are the numbers a
// 60 Hz game wants.

const TICK_MS = 1000 / 60

/** Feeds `count` pongs measured against a link that needs `needed` ticks of lead. */
function converge(lead: InputLead, needed: (index: number) => number, count = 40): void {
  for (let index = 0; index < count; index += 1) {
    const sentAt = lead.ticks
    // Slack is how early the probe was: the lead it was sent with, less what the link consumed.
    lead.observe(sentAt, sentAt - needed(index))
    // A quarter of a second between probes, as the session sends them.
    for (let frame = 0; frame < 15; frame += 1) lead.advance(TICK_MS)
  }
}

describe('the input lead', () => {
  it('starts at a lead a typical link needs, before it has heard anything', () => {
    expect(new InputLead().ticks).toBe(INITIAL_LEAD_TICKS)
  })

  it('settles two ticks of margin ahead of a steady link', () => {
    const lead = new InputLead()
    converge(lead, () => 7)
    expect(lead.ticks).toBeCloseTo(9, 1)
    expect(lead.target).toBeCloseTo(9, 1)
  })

  it('widens its margin to cover jitter', () => {
    const steady = new InputLead()
    const jittery = new InputLead()
    converge(steady, () => 7)
    converge(jittery, (index) => 7 + ((index * 5) % 4) - 1.5)
    expect(jittery.ticks).toBeGreaterThan(steady.ticks + 1)
  })

  it('jumps forward on its first answer rather than running late for a second', () => {
    const lead = new InputLead()
    lead.observe(lead.ticks, lead.ticks - 12)
    expect(lead.ticks).toBeCloseTo(14, 6)
  })

  it('eases forward after its first answer rather than leaping', () => {
    const lead = new InputLead()
    converge(lead, () => 7)
    const before = lead.ticks
    for (let index = 0; index < 20; index += 1) lead.observe(lead.ticks, lead.ticks - 15)
    lead.advance(TICK_MS)
    expect(lead.ticks - before).toBeCloseTo(0.1, 9)
  })

  it('only ever eases backward, so the predicted tick never runs back', () => {
    const lead = new InputLead()
    converge(lead, () => 12)
    const before = lead.ticks

    // One quick probe is an outlier the median ignores; a link that really got faster says so in most of the window.
    lead.observe(before, before - 2)
    expect(lead.target).toBe(before)
    for (let index = 0; index < 15; index += 1) lead.observe(before, before - 2)
    expect(lead.target).toBeLessThan(before)

    lead.advance(TICK_MS)
    // At most a tenth of a tick per tick of elapsed time.
    expect(before - lead.ticks).toBeLessThanOrEqual(0.1 + 1e-9)
    expect(lead.ticks).toBeLessThan(before)
  })

  it('is bounded however bad the link claims to be', () => {
    const lead = new InputLead()
    lead.observe(0, -500)
    expect(lead.ticks).toBe(MAX_LEAD_TICKS)
    const zero = new InputLead()
    converge(zero, () => -40)
    expect(zero.ticks).toBeGreaterThanOrEqual(0)
  })

  it('ignores a probe answered without a slack', () => {
    const lead = new InputLead()
    lead.observe(4, Number.NaN)
    expect(lead.ticks).toBe(INITIAL_LEAD_TICKS)
  })
})

describe('a lead from a known round trip', () => {
  it('covers the trip in ticks plus the margin a measured lead would carry', () => {
    expect(leadForRoundTrip(100)).toBeCloseTo(100 / TICK_MS + 3, 9)
    expect(new InputLead(leadForRoundTrip(100)).ticks).toBeCloseTo(9, 9)
  })

  it('falls back to the default without one', () => {
    expect(leadForRoundTrip(undefined)).toBe(INITIAL_LEAD_TICKS)
    expect(leadForRoundTrip(Number.NaN)).toBe(INITIAL_LEAD_TICKS)
  })
})

describe('another tick rate and cap', () => {
  it("measures in the sim's own ticks and holds the cap it is given", () => {
    // 30 Hz: a 100 ms trip is three ticks, plus the margin.
    expect(leadForRoundTrip(100, { tickHz: 30, maxTicks: 15 })).toBeCloseTo(6, 9)
    const capped = new InputLead(4, { tickHz: 30, maxTicks: 15 })
    capped.observe(0, -500)
    expect(capped.ticks).toBe(15)
  })
})
