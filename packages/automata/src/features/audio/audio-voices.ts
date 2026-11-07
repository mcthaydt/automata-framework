// One-shot sounds. From FloorFifty `apps/client/src/managers/audio/voices.ts` and `model.ts` at
// `ac72660`, without its event de-duplication, far paths, panning and variation, which are FloorFifty's own.
import type { AudioGraph, SubBus } from './audio-graph.js'

/** At most this many one-shots sound at once (FloorFifty `model.ts`): a burst can never exhaust the machine. */
export const MAX_VOICES = 16

/** How long a cut voice fades before it stops, so it never clicks (FloorFifty `model.ts`). */
export const CUT_SECONDS = 0.02

export interface VoiceOptions {
  readonly bus: SubBus | 'master'
  readonly gain?: number
  readonly rate?: number
}

export class Voices {
  private voices: Array<{ readonly source: AudioBufferSourceNode; readonly level: GainNode }> = []
  /** Bumped by `cancelPending`; a decode that finishes under an older generation never plays. */
  private generation = 0

  constructor(private readonly graph: AudioGraph) {}

  /** How many one-shots are sounding. */
  get active(): number {
    return this.voices.length
  }

  /**
   * Plays one sound, once its buffer decodes. Silent before the graph is built, which is the ordinary state of a
   * page nobody has touched yet rather than an error, and silent while the graph is silenced: a sound asked for
   * while nobody could hear it must not sound later either.
   */
  async play(load: () => Promise<AudioBuffer | undefined>, options: VoiceOptions): Promise<void> {
    if (this.graph.context === undefined || this.graph.silenced) return
    const generation = this.generation
    const buffer = await load()
    const context = this.graph.context
    const into = this.graph.input(options.bus)
    if (buffer === undefined || generation !== this.generation || this.graph.silenced || into === undefined)
      return
    // The oldest goes, not the newest: the most recent sound is the one the player is watching.
    for (
      let oldest = this.voices[0];
      oldest !== undefined && this.voices.length >= MAX_VOICES;
      oldest = this.voices[0]
    )
      this.cut(oldest)

    const source = context.createBufferSource()
    source.buffer = buffer
    if (options.rate !== undefined && options.rate !== 1) source.playbackRate.value = options.rate
    // Its own level always, even at one: it is what a cut fades.
    const level = context.createGain()
    level.gain.value = Math.min(1, Math.max(0, options.gain ?? 1))
    level.connect(into)
    source.connect(level)
    const voice = { source, level }
    source.onended = () => {
      this.voices = this.voices.filter((other) => other !== voice)
      level.disconnect()
    }
    source.start(0)
    this.voices.push(voice)
  }

  /** Drops the sounds still decoding; the graph's sleep calls it, so a sound asked for before sleep never plays. */
  cancelPending(): void {
    this.generation += 1
  }

  /** Stops every voice: the runtime is going away. */
  stopAll(): void {
    for (const { source } of this.voices) source.stop()
    this.voices = []
  }

  private cut(voice: { readonly source: AudioBufferSourceNode; readonly level: GainNode }): void {
    this.voices = this.voices.filter((other) => other !== voice)
    fadeOut(this.graph.context?.currentTime ?? 0, voice.source, voice.level, CUT_SECONDS)
  }
}

/**
 * Ramps `level` to silence over `seconds` from `at`, then stops `source`. The level is pinned where it is before the
 * ramp, so the fade starts from what is heard; a stop without a fade is a click.
 */
export function fadeOut(at: number, source: AudioBufferSourceNode, level: GainNode, seconds: number): void {
  const param = level.gain
  param.cancelScheduledValues(at)
  param.setValueAtTime(param.value, at)
  param.linearRampToValueAtTime(0, at + seconds)
  source.stop(at + seconds)
}
