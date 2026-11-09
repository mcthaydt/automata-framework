import type { AudioContent, Cue } from '@automata/audio-synth'
import { describe, expect, it } from 'vitest'
import {
  checkSounds,
  findingWords,
  isCurrent,
  type RenderCue,
  type SoundFinding,
  signatureOf,
} from '#src/features/audio/audio-findings.ts'

const RATE = 48000
const cue = (id: string): Cue => ({
  id,
  bus: 'sfx',
  voices: [{ tone: 'sine', from: 440, to: 440, length: 0.2, volume: 0.3 }],
})
const content: AudioContent = { cue: [cue('clean'), cue('loud'), cue('clicky'), cue('silent'), cue('faint')] }

/** One second of a 440 Hz sine at `amplitude`. */
const sine = (amplitude: number): Float32Array =>
  Float32Array.from({ length: RATE }, (_, i) => amplitude * Math.sin((2 * Math.PI * 440 * i) / RATE))

// Fixed samples stand in for the page's offline render: Node has no Web Audio, and what is checked here is the measuring.
const render: RenderCue = async (_content, id) => {
  switch (id) {
    case 'loud':
      return [sine(1.2), sine(1.2)].map((channel) => channel.map((v) => Math.max(-1, Math.min(1, v))))
    case 'clicky': {
      const channel = sine(0.3)
      for (let i = RATE / 2; i < RATE; i++) channel[i] = (channel[i] as number) + 0.5
      return [channel, channel]
    }
    case 'silent':
      return [new Float32Array(RATE), new Float32Array(RATE)]
    case 'faint':
      return [sine(0.0005), sine(0.0005)]
    default:
      return [sine(0.3), sine(0.3)]
  }
}

describe('Check the sounds', () => {
  it('finds a sound too loud at its peak, one that clicks, and ones too quiet to hear, and passes a clean one', async () => {
    const found = await checkSounds(content, render, RATE)
    expect(found.filter((one) => one.sound === 'clean')).toEqual([])
    expect(found.find((one) => one.sound === 'loud')).toMatchObject({ kind: 'peak' })
    expect((found.find((one) => one.sound === 'loud') as SoundFinding).value).toBeGreaterThan(-1)
    const click = found.find((one) => one.sound === 'clicky')
    expect(click).toMatchObject({ kind: 'clicks' })
    expect(click?.value).toBeCloseTo(0.5, 2)
    expect(found.find((one) => one.sound === 'silent')).toMatchObject({ kind: 'quiet', value: null })
    expect(found.find((one) => one.sound === 'faint')).toMatchObject({ kind: 'quiet' })
    expect((found.find((one) => one.sound === 'faint') as SoundFinding).value).toBeLessThan(-40)
  })

  it('says each finding in words', () => {
    expect(findingWords({ sound: 'a', kind: 'peak', value: -0.4 })).toBe(
      'Too loud at its peak: −0.4 dB. Keep it under −1 dB.',
    )
    expect(findingWords({ sound: 'a', kind: 'clicks', value: 0.12 })).toBe('Clicks at 0.12 s.')
    expect(findingWords({ sound: 'a', kind: 'quiet', value: -52.34 })).toBe(
      'Too quiet to hear: its peak is −52.3 dB. Raise its loudness.',
    )
    expect(findingWords({ sound: 'a', kind: 'quiet', value: null })).toBe(
      'Silent: nothing can be heard. Add a tone or a hiss.',
    )
  })

  it('knows a finding is out of date once its sound changes, or is renamed, and never pins it to another', () => {
    const signatures = signatureOf(content)
    expect(isCurrent(content, signatures, 'loud')).toBe(true)
    const changed: AudioContent = {
      cue: (content.cue ?? []).map((one) =>
        one.id === 'loud'
          ? { ...one, voices: [{ ...(one.voices[0] as Cue['voices'][number]), volume: 0.1 }] }
          : one,
      ),
    }
    expect(isCurrent(changed, signatures, 'loud')).toBe(false)
    expect(isCurrent(changed, signatures, 'clean')).toBe(true)
    const renamed: AudioContent = {
      cue: (content.cue ?? []).map((one) => (one.id === 'loud' ? { ...one, id: 'booming' } : one)),
    }
    expect(isCurrent(renamed, signatures, 'loud')).toBe(false)
    expect(isCurrent(renamed, signatures, 'booming')).toBe(false)
  })
})
