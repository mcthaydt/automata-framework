// The browser runner for the audio pipeline: the real render module in real Chromium (Node has no OfflineAudioContext).
import type { AudioContent } from '@automata/audio-synth'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type AudioRenderer, openAudioRenderer } from '#src/features/audio/audio-browser.ts'

const content: AudioContent = {
  cue: [
    { id: 'beep', bus: 'sfx', voices: [{ tone: 'sine', from: 440, to: 440, length: 0.2, volume: 0.5 }] },
    { id: 'hiss', bus: 'sfx', voices: [{ hiss: 2000, q: 1, length: 0.1, volume: 0.5 }] },
    // A line too quiet to hear: only its duck shows in the bed.
    { id: 'probe', bus: 'voice', voices: [{ tone: 'sine', from: 300, to: 300, length: 1, volume: 1e-9 }] },
  ],
  bed: [{ id: 'hum', bus: 'music', volume: 0.3, drones: [{ wave: 'sine', freq: 60 }] }],
  duck: [{ bus: 'voice', duck: ['music'], db: -12, attack: 0.1, release: 0.4 }],
}
const peak = (x: readonly number[]): number => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
const rms = (x: readonly number[], from: number, to: number): number =>
  Math.sqrt(x.slice(from, to).reduce((s, v) => s + v * v, 0) / (to - from))

let renderer: AudioRenderer
beforeAll(async () => {
  renderer = await openAudioRenderer()
}, 60_000)
afterAll(async () => {
  await renderer.close()
})

describe('the audio renderer (Chromium)', () => {
  it('renders a cue to stereo samples at 48 kHz that are not silent', async () => {
    const out = await renderer.cue(content, 'beep', { seconds: 0.5 })
    expect(out).toHaveLength(2)
    expect(out[0]).toHaveLength(24000)
    expect(peak(out[0] ?? [])).toBeGreaterThan(0.05)
    expect(peak(out[0] ?? [])).toBeLessThanOrEqual(1)
  })
  it('renders the same samples twice, noise included', async () => {
    const a = await renderer.cue(content, 'hiss', { seconds: 0.3 })
    const b = await renderer.cue(content, 'hiss', { seconds: 0.3 })
    expect(a[0]).toEqual(b[0])
    expect(peak(a[0] ?? [])).toBeGreaterThan(0.001)
  })
  it('renders a bed', async () => {
    const out = await renderer.bed(content, 'hum', 1)
    expect(peak(out[0] ?? [])).toBeGreaterThan(0.01)
  })
  it('ducks the bed by the rule’s depth while a line plays', async () => {
    const dry = await renderer.duck(content, { seconds: 3.5, at: 1, line: null })
    const wet = await renderer.duck(content, { seconds: 3.5, at: 1, line: 'probe' })
    const window = [Math.round(1.3 * 48000), Math.round(1.9 * 48000)] as const
    const drop = 20 * Math.log10(rms(wet[0] ?? [], ...window) / rms(dry[0] ?? [], ...window))
    expect(drop).toBeGreaterThan(-13)
    expect(drop).toBeLessThan(-11)
  })
  it('names an unknown cue', async () => {
    await expect(renderer.cue(content, 'nope', { seconds: 1 })).rejects.toThrow(/no cue "nope"/)
  })
})
