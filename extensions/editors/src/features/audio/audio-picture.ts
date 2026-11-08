// A sound drawn: each voice a bar across the part of the sound it lasts, standing at its pitch, so a person sees the
// shape of what they will hear. A tone slopes from where it starts to where it ends; a hiss is a band. Pitch is on a log
// scale, from 50 Hz at the bottom to 8 kHz at the top, because the ear hears equal ratios as equal steps.
import type { Cue, Voice } from '@automata/audio-synth'

export interface PictureBar {
  readonly kind: 'tone' | 'hiss'
  readonly x: number
  readonly w: number
  /** From the top. A tone: where it starts and where it ends, so a tone that rises has `y1` above `y0`. A hiss: the top and bottom of its band. */
  readonly y0: number
  readonly y1: number
}

const LOW = 50
const HIGH = 8000
/** The least a hiss band is tall, so a narrow hiss can still be seen. */
const THIN = 4

const clamp = (value: number, least: number, most: number): number => Math.min(most, Math.max(least, value))

export function picture(cue: Cue, width: number, height: number): PictureBar[] {
  const total = Math.max(0, ...cue.voices.map((voice) => (voice.at ?? 0) + voice.length))
  if (total === 0) return []
  const y = (hz: number): number => clamp(height * (1 - Math.log(hz / LOW) / Math.log(HIGH / LOW)), 0, height)
  return cue.voices.map((voice: Voice): PictureBar => {
    const x = ((voice.at ?? 0) / total) * width
    const w = (voice.length / total) * width
    if (voice.hiss === undefined)
      return { kind: 'tone', x, w, y0: y(voice.from ?? LOW), y1: y(voice.to ?? voice.from ?? LOW) }
    // A narrow hiss (a high q) is thin; a range of pitches spans from its lowest to its highest.
    const [low, high] = typeof voice.hiss === 'number' ? [voice.hiss, voice.hiss] : voice.hiss
    const middle = (y(low) + y(high)) / 2
    const half = Math.max(THIN, Math.abs(y(low) - y(high)), 24 / (voice.q ?? 1)) / 2
    return { kind: 'hiss', x, w, y0: clamp(middle - half, 0, height), y1: clamp(middle + half, 0, height) }
  })
}
