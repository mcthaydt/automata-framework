// What makes a sound in the page: Web Audio, made on the first Play so the page never makes noise by itself. A sound
// plays once through its own voices; playing never writes the file.
import { type AudioContent, playCue } from '@automata/audio-synth'
import { checkSounds, pageRender, type RenderCue, type SoundFinding } from './audio-findings.ts'
import type { AudioPlay } from './audio-session.svelte.ts'

export interface AudioOutput {
  readonly play: AudioPlay
  /** Whether the first Play has made the audio context yet. */
  readonly started: () => boolean
  /** Renders every sound of `content` in the page and measures it. Nothing sounds. */
  check(content: AudioContent): Promise<SoundFinding[]>
  close(): void
}

/** The sounds of `content` through a context `make` builds once, on the first Play. `render` draws a sound off screen. */
export function browserAudio(
  make: () => AudioContext,
  render: RenderCue = pageRender((channels, frames, rate) => new OfflineAudioContext(channels, frames, rate)),
): AudioOutput {
  let context: AudioContext | undefined
  return {
    check: (content) => checkSounds(content, render),
    started: () => context !== undefined,
    async play(content: AudioContent, what) {
      const cue = content.cue?.find((candidate) => candidate.id === what.id)
      if (cue === undefined) throw new Error(`there is no sound called ${what.id}`)
      context ??= make()
      // A page may only start sound after a tap, so the context starts suspended until this Play resumes it.
      if (context.state === 'suspended') await context.resume()
      // The overall volume is the file's, so a change to it is heard on the next Play.
      const master = context.createGain()
      master.gain.value = content.master_gain ?? 1
      master.connect(context.destination)
      playCue(context, master, cue)
    },
    close() {
      void context?.close()
      context = undefined
    },
  }
}

/** The page that cannot make sound (a test, a server): Play says so in words. */
export const silentAudio: AudioOutput = {
  started: () => false,
  play: () => Promise.reject(new Error('this page cannot make sound')),
  check: () => Promise.reject(new Error('this page cannot check sounds')),
  close: () => undefined,
}
