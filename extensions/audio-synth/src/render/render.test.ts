import { describe, expect, it } from 'vitest'
import type { AudioContent } from '../audio.schema'
import { fakeOffline } from '../testing/fake-offline'
import { offlinePort, renderBed, renderCue, renderDuck, renderMix, SAMPLE_RATE, seeded } from './index'

const content: AudioContent = {
  cue: [
    { id: 'beep', bus: 'sfx', voices: [{ tone: 'sine', from: 440, to: 440, length: 0.2, volume: 0.5 }] },
    { id: 'hiss', bus: 'sfx', voices: [{ hiss: 2000, q: 1, length: 0.1, volume: 0.5 }] },
    {
      id: 'step',
      bus: 'sfx',
      world: true,
      voices: [{ tone: 'sine', from: 200, to: 100, length: 0.1, volume: 0.5 }],
    },
    { id: 'line', bus: 'voice', voices: [{ tone: 'sine', from: 300, to: 300, length: 1, volume: 0.5 }] },
  ],
  bed: [{ id: 'hum', bus: 'music', volume: 0.3, drones: [{ wave: 'sine', freq: 60 }] }],
  duck: [{ bus: 'voice', duck: ['music'], db: -12, attack: 0.1, release: 0.4 }],
}
const kinds = (calls: readonly string[], prefix: string): string[] =>
  calls.filter((c) => c.startsWith(prefix))

describe('seeded', () => {
  it('gives the same sequence for the same seed and another for another', () => {
    const a = seeded(3)
    const b = seeded(3)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
    expect(seeded(4)()).not.toBe(seeded(3)())
  })
})

describe('renderCue', () => {
  it('renders into a stereo context of the cue seconds at 48 kHz and returns the channels', async () => {
    const { make, built } = fakeOffline()
    const out = await renderCue({ make }, content, 'beep', { seconds: 0.5 })
    expect(built[0]).toMatchObject({ channels: 2, frames: 24000, rate: SAMPLE_RATE })
    expect(out).toHaveLength(2)
    expect(out[0]).toHaveLength(24000)
  })
  it('schedules the cue’s voices from time zero', async () => {
    const { make, built } = fakeOffline()
    await renderCue({ make }, content, 'beep', { seconds: 0.5 })
    const osc = built[0]?.ctx.nodes.find((n) => n.kind === 'oscillator')
    expect(kinds(osc?.calls ?? [], 'start')).toEqual(['start 0'])
  })
  it('is the same every time: noise is seeded', async () => {
    const a = fakeOffline()
    const b = fakeOffline()
    await renderCue(a, content, 'hiss', { seconds: 0.3 })
    await renderCue(b, content, 'hiss', { seconds: 0.3 })
    const centres = (o: ReturnType<typeof fakeOffline>) =>
      o.built[0]?.ctx.nodes.filter((n) => n.kind === 'biquad').map((n) => n.params.frequency?.calls)
    expect(centres(a)).toEqual(centres(b))
  })
  it('names the cues when the id is unknown', async () => {
    await expect(renderCue(fakeOffline(), content, 'nope', { seconds: 1 })).rejects.toThrow(
      /no cue "nope".*beep/,
    )
  })
  it('pans a world cue when it has a place and a listener, and not otherwise', async () => {
    const placed = fakeOffline()
    await renderCue(placed, content, 'step', {
      seconds: 0.3,
      place: { at: { x: 4, z: 0 }, listener: { x: 0, z: 0, yaw: 0 } },
    })
    expect(placed.built[0]?.ctx.nodes.some((n) => n.kind === 'panner')).toBe(true)
    const flat = fakeOffline()
    await renderCue(flat, content, 'step', { seconds: 0.3 })
    expect(flat.built[0]?.ctx.nodes.some((n) => n.kind === 'panner')).toBe(false)
  })
})

describe('renderBed', () => {
  it('starts the bed on its bus and renders the seconds asked', async () => {
    const { make, built } = fakeOffline()
    const out = await renderBed({ make }, content, 'hum', 2)
    expect(built[0]?.frames).toBe(96000)
    expect(built[0]?.ctx.nodes.some((n) => n.kind === 'oscillator')).toBe(true)
    expect(out[0]).toHaveLength(96000)
  })
  it('names the beds when the id is unknown', async () => {
    await expect(renderBed(fakeOffline(), content, 'nope', 1)).rejects.toThrow(/no bed "nope".*hum/)
  })
})

describe('renderMix', () => {
  it('plays each cue at its time over the bed', async () => {
    const { make, built } = fakeOffline()
    await renderMix({ make }, content, {
      seconds: 3,
      bed: 'hum',
      sequence: [
        { t: 0.5, cue: 'beep' },
        { t: 1.5, cue: 'beep' },
      ],
    })
    const starts = built[0]?.ctx.nodes
      .filter((n) => n.kind === 'oscillator')
      .flatMap((n) => kinds(n.calls, 'start'))
    expect(starts).toContain('start 0.5')
    expect(starts).toContain('start 1.5')
    expect(starts).toContain('start 0')
  })
})

describe('offlinePort', () => {
  it('gives one gain per bus into the destination, the same node each time', () => {
    const { make, built } = fakeOffline()
    const ctx = make(2, 100, 48000) as never
    const port = offlinePort(ctx)
    const a = port.input('sfx')
    expect(port.input('sfx')).toBe(a)
    expect(port.input('music')).not.toBe(a)
    const fake = built[0]?.ctx
    expect(
      fake?.nodes.filter((n) => n.kind === 'gain').every((n) => n.connections.includes(fake.destination)),
    ).toBe(true)
  })
  it('ducks a bus down, holds, and lets it back up', () => {
    const { make, built } = fakeOffline()
    const port = offlinePort(make(2, 100, 48000) as never, { release: 0.4 })
    const node = port.input('music') as never as { gain: { calls: string[] } }
    port.duck('music', 0.75, 1)
    expect(node.gain.calls.some((c) => c.startsWith('lin 0.25'))).toBe(true)
    expect(node.gain.calls.some((c) => c.startsWith('lin 1 @1.4'))).toBe(true)
    expect(built).toHaveLength(1)
  })
})

describe('renderDuck', () => {
  it('ducks the music bed only when a line plays', async () => {
    const withLine = fakeOffline()
    await renderDuck(withLine, content, { seconds: 3, at: 1, line: 'line' })
    const dry = fakeOffline()
    await renderDuck(dry, content, { seconds: 3, at: 1, line: null })
    const lin = (o: ReturnType<typeof fakeOffline>) =>
      o.built[0]?.ctx.nodes
        .flatMap((n) => Object.values(n.params).flatMap((p) => p.calls))
        .filter((c) => c.startsWith('lin 0.25'))
    expect(lin(withLine)?.length).toBeGreaterThan(0)
    expect(lin(dry)).toEqual([])
  })
})
