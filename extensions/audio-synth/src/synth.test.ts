// The synth (M6.10a step 2; from the adventure source's `synth.ts`): a cue's voices, or a bed's drones, scheduled on any
// BaseAudioContext, so the live context and an offline one play the same thing. Read through a recording fake context.
import { describe, expect, it } from 'vitest'
import type { Bed, Cue } from './audio.schema'
import { cueLength, noiseBuffer, playCue, playVoice, startBed } from './synth'
import { type FakeContext, type FakeNode, fakeContext } from './testing/fake-audio'

const ctx = (): FakeContext => fakeContext()
const as = <T>(c: FakeContext): T => c as unknown as T
const of = (c: FakeContext, kind: string): FakeNode[] => c.nodes.filter((n) => n.kind === kind)

describe('noiseBuffer', () => {
  it('is seeded white noise in [-1, 1], the same every time', () => {
    const a = noiseBuffer(as(ctx()), 0.5)
    const b = noiseBuffer(as(ctx()), 0.5)
    const data = (a as unknown as { data: Float32Array }).data
    expect(data.length).toBe(4000)
    expect(Array.from(data)).toEqual(Array.from((b as unknown as { data: Float32Array }).data))
    expect(Math.max(...data)).toBeLessThanOrEqual(1)
    expect(Math.min(...data)).toBeGreaterThanOrEqual(-1)
    expect(new Set(data).size).toBeGreaterThan(100)
  })
})

describe('playVoice', () => {
  it('sweeps a tone exponentially, its gain decaying to silence, and connects it to the output', () => {
    const c = ctx()
    const out = c.destination
    playVoice(as(c), out as never, { tone: 'sine', from: 90, to: 30, length: 0.6, volume: 0.8 }, 1)
    const [osc] = of(c, 'oscillator') as [FakeNode]
    expect((osc as unknown as { type?: string }).type).toBe('sine')
    expect(osc.params.frequency?.calls).toEqual(['set 90 @1', 'exp 30 @1.6'])
    const [gain] = of(c, 'gain') as [FakeNode]
    expect(gain.params.gain?.calls).toEqual(['set 0.8 @1', 'exp 0.0001 @1.6'])
    expect(osc.connections).toEqual([gain])
    expect(gain.connections).toEqual([out])
    expect(osc.calls).toEqual(['start 1', 'stop 1.65'])
  })
  it('starts a voice `at` seconds after the cue, and never sweeps to a frequency under 1 Hz', () => {
    const c = ctx()
    playVoice(
      as(c),
      c.destination as never,
      { tone: 'square', from: 100, to: 0, at: 0.3, length: 0.1, volume: 0.1 },
      2,
    )
    const [osc] = of(c, 'oscillator') as [FakeNode]
    expect(osc.params.frequency?.calls).toEqual(['set 100 @2.3', 'exp 1 @2.4'])
  })
  it('plays a hiss as noise through a band-pass at its centre, and picks the centre of a range with `random`', () => {
    const c = ctx()
    playVoice(as(c), c.destination as never, { hiss: 900, q: 3, length: 0.4, volume: 0.6 }, 0)
    const [filter] = of(c, 'biquad') as [FakeNode]
    expect(filter.params.frequency?.value).toBe(900)
    expect(filter.params.Q?.value).toBe(3)
    const r = ctx()
    playVoice(as(r), r.destination as never, { hiss: [1800, 3800], length: 0.04, volume: 0.15 }, 0, () => 0.5)
    expect((of(r, 'biquad')[0] as FakeNode).params.frequency?.value).toBe(2800)
    expect((of(r, 'biquad')[0] as FakeNode).params.Q?.value).toBe(1)
  })
})

const BANG: Cue = {
  id: 'bang',
  bus: 'sfx',
  voices: [
    { tone: 'sine', from: 90, to: 30, length: 0.6, volume: 0.8 },
    { hiss: 900, length: 0.4, volume: 0.6 },
    { hiss: 4200, at: 0.05, length: 1.2, volume: 0.2, q: 3 },
  ],
}

describe('playCue and cueLength', () => {
  it('schedules every voice', () => {
    const c = ctx()
    playCue(as(c), c.destination as never, BANG, 0, () => 0)
    expect(of(c, 'oscillator')).toHaveLength(1)
    expect(of(c, 'biquad')).toHaveLength(2)
  })
  it('lasts until its last voice ends, a tone ringing 0.05 s past its ramp', () => {
    expect(cueLength(BANG)).toBeCloseTo(1.25, 6)
    expect(cueLength({ ...BANG, voices: [] })).toBe(0)
    expect(
      cueLength({ ...BANG, voices: [{ tone: 'sine', from: 1, to: 1, length: 2, volume: 1 }] }),
    ).toBeCloseTo(2.05, 6)
  })
})

describe('startBed', () => {
  const BED: Bed = {
    id: 'hum',
    bus: 'music',
    volume: 0.035,
    drones: [
      { wave: 'sine', freq: 55 },
      { wave: 'sine', freq: 110.4, volume: 0.5 },
    ],
    noise: { freq: 400, q: 1, volume: 0.1 },
    pulse: { rate: 2.4, depth: 0.6 },
  }
  it('starts its drones, its noise and its pulse, and stops them all together', () => {
    const c = ctx()
    const stop = startBed(as(c), c.destination as never, BED)
    expect(of(c, 'oscillator')).toHaveLength(3)
    expect(of(c, 'buffer')).toHaveLength(1)
    const level = of(c, 'gain')[0] as FakeNode
    expect(level.params.gain?.value).toBe(0.035)
    stop(5)
    const stops = c.nodes.flatMap((n) => n.calls.filter((x) => x.startsWith('stop')))
    expect(stops).toHaveLength(4)
    expect(new Set(stops)).toEqual(new Set(['stop 5']))
  })
  it('gives a drone with its own volume a gain of its own, and the others none', () => {
    const c = ctx()
    startBed(as(c), c.destination as never, { ...BED, noise: undefined, pulse: undefined })
    const gains = of(c, 'gain')
    expect(gains).toHaveLength(2)
    expect(gains[1]?.params.gain?.value).toBe(0.5)
  })
})
