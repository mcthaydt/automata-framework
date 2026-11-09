// "Check the sounds": every sound is rendered in the page (an `OfflineAudioContext`, the same synth and mixer the game
// uses) and measured: too loud at its peak, a click inside it, too quiet to hear. A finding belongs to the sound it was
// found in as that sound was then, so a sound that has changed since, or been renamed, never shows an old finding.
import { type AudioContent, type Cue, cueLength } from '@automata/audio-synth'
import { clicks, truePeak } from '@automata/audio-synth/measure'
import { type OfflineLike, renderCue, SAMPLE_RATE } from '@automata/audio-synth/render'

/** The true-peak ceiling the audio pipeline holds a sound to. */
export const PEAK_CEILING_DB = -1
/** Under this a sound is too quiet to hear. */
export const QUIET_BELOW_DB = -40
/** Seconds past a sound's end that are rendered, so a tail is heard too (the pipeline's default). */
const TAIL = 0.5

export interface SoundFinding {
  readonly sound: string
  readonly kind: 'peak' | 'clicks' | 'quiet'
  /** The peak in dB, the first click's time in seconds, or the peak in dB (null for none at all). */
  readonly value: number | null
}

/** How a sound is rendered: the channels it makes in `seconds`. */
export type RenderCue = (content: AudioContent, id: string, seconds: number) => Promise<Float32Array[]>

/** The renderer of the page: `make` builds an offline context. */
export const pageRender =
  (make: (channels: number, frames: number, rate: number) => OfflineLike): RenderCue =>
  (content, id, seconds) =>
    renderCue({ make }, content, id, { seconds })

export async function checkSounds(
  content: AudioContent,
  render: RenderCue,
  rate: number = SAMPLE_RATE,
): Promise<SoundFinding[]> {
  const found: SoundFinding[] = []
  for (const cue of content.cue ?? []) {
    const channels = await render(content, cue.id, cueLength(cue) + TAIL)
    const peak = truePeak(channels)
    if (!Number.isFinite(peak) || peak < QUIET_BELOW_DB)
      found.push({ sound: cue.id, kind: 'quiet', value: Number.isFinite(peak) ? peak : null })
    else if (peak > PEAK_CEILING_DB) found.push({ sound: cue.id, kind: 'peak', value: peak })
    const click = channels.flatMap((channel) => clicks(channel, rate)).sort((a, b) => a - b)[0]
    if (click !== undefined) found.push({ sound: cue.id, kind: 'clicks', value: click / rate })
  }
  return found
}

const minus = (value: number, places: number): string => value.toFixed(places).replace('-', '−')

export function findingWords(finding: SoundFinding): string {
  const value = finding.value
  if (finding.kind === 'peak')
    return `Too loud at its peak: ${minus(value ?? 0, 1)} dB. Keep it under ${minus(PEAK_CEILING_DB, 0)} dB.`
  if (finding.kind === 'clicks') return `Clicks at ${(value ?? 0).toFixed(2)} s.`
  return value === null
    ? 'Silent: nothing can be heard. Add a tone or a hiss.'
    : `Too quiet to hear: its peak is ${minus(value, 1)} dB. Raise its loudness.`
}

/** What a sound was when it was checked: its whole recipe, by name. */
export const signatureOf = (content: AudioContent): ReadonlyMap<string, string> =>
  new Map((content.cue ?? []).map((cue: Cue) => [cue.id, JSON.stringify(cue)]))

/** Whether the sound called `id` is exactly as it was when `signatures` were taken. */
export function isCurrent(
  content: AudioContent,
  signatures: ReadonlyMap<string, string>,
  id: string,
): boolean {
  const now = (content.cue ?? []).find((cue) => cue.id === id)
  return now !== undefined && signatures.get(id) === JSON.stringify(now)
}
