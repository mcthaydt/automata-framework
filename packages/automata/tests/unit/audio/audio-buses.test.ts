import { describe, expect, it } from 'vitest'
import {
  AUDIO_BUS_NAMES,
  type AudioBusGains,
  audioBusGainsSchema,
} from '#src/features/audio/audio-buses.schema.ts'
import type { AudioBuses, AudioBusName } from '#src/features/audio/audio-buses.ts'

// Audio buses (PRODUCT spec §2 F1, §3 "Audio buses"): master over music, sfx and ui. The Web Audio graph
// behind the port is M5's core audio; an extension (Plus `audio-stream`) or the game connects sources to a
// bus through the port, and a settings screen stores the gains.

describe('audio bus gains', () => {
  it('names master and the buses under it, with voice (M5-D3)', () => {
    expect(AUDIO_BUS_NAMES).toEqual(['master', 'music', 'sfx', 'ui', 'voice'])
  })

  it('defaults every gain to full and keeps a saved gain', () => {
    expect(audioBusGainsSchema.parse({})).toEqual({ master: 1, music: 1, sfx: 1, ui: 1, voice: 1 })
    expect(audioBusGainsSchema.parse({ music: 0.25 })).toEqual({
      master: 1,
      music: 0.25,
      sfx: 1,
      ui: 1,
      voice: 1,
    })
  })

  it('rejects a gain outside 0..1 instead of clamping it silently', () => {
    expect(audioBusGainsSchema.safeParse({ sfx: 1.5 }).success).toBe(false)
    expect(audioBusGainsSchema.safeParse({ master: -0.1 }).success).toBe(false)
  })
})

describe('the AudioBuses port', () => {
  it('lets extension code route a source to a bus and set its gain through the port', () => {
    // A stand-in for M5's Web Audio implementation, as a test or a game without M5 would write it.
    const gains: AudioBusGains = audioBusGainsSchema.parse({})
    const connected: Array<{ source: string; bus: AudioBusName }> = []
    const buses: AudioBuses = {
      input: (bus) => ({ bus }) as unknown as AudioNode,
      gain: (bus) => gains[bus],
      setGain: (bus, gain) => {
        ;(gains as Record<AudioBusName, number>)[bus] = gain
      },
    }

    const musicExtension = (audio: AudioBuses) => {
      const input = audio.input('music') as unknown as { bus: AudioBusName }
      connected.push({ source: 'menu-theme', bus: input.bus })
      audio.setGain('music', 0.5)
      return audio.gain('music')
    }

    const gain = musicExtension(buses)
    expect(connected).toEqual([{ source: 'menu-theme', bus: 'music' }])
    expect(gain).toBe(0.5)
  })
})
