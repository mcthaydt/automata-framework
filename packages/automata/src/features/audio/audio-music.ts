// Decoded music: one looping track at a time on the music bus, for short loops and menu beds.
// It has no sections, previews or tails, and no streamed deck: those are a game's own or `audio-stream`'s.
import type { AudioGraph } from './audio-graph.js'
import { CUT_SECONDS, fadeOut } from './audio-voices.js'

/** Options for `Audio.music`: where to begin and which region loops. */
export interface MusicOptions {
  /** Where in the track to begin, in seconds. */
  readonly fromSeconds?: number
  /** The region that loops, in seconds; the whole track without it. */
  readonly loop?: { readonly start: number; readonly end: number }
}

export class MusicSlot {
  private playing: { readonly source: AudioBufferSourceNode; readonly level: GainNode } | undefined

  constructor(private readonly graph: AudioGraph) {}

  /** Loops `buffer` on the music bus, cutting whatever played before. Nothing before the graph is built. */
  play(buffer: AudioBuffer, options: MusicOptions = {}): void {
    const context = this.graph.context
    const into = this.graph.input('music')
    if (context === undefined || into === undefined) return
    this.stop(CUT_SECONDS)
    const source = context.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.loopStart = options.loop?.start ?? 0
    source.loopEnd = options.loop?.end ?? 0
    // Its own level, which a stop fades.
    const level = context.createGain()
    level.connect(into)
    source.connect(level)
    const track = { source, level }
    source.onended = () => {
      if (this.playing === track) this.playing = undefined
      level.disconnect()
    }
    source.start(0, options.fromSeconds ?? 0)
    this.playing = track
  }

  /** Fades the track out over `fadeSeconds` and stops it; a cut (a few milliseconds) by default. */
  stop(fadeSeconds: number = CUT_SECONDS): void {
    const track = this.playing
    if (track === undefined) return
    this.playing = undefined
    fadeOut(
      this.graph.context?.currentTime ?? 0,
      track.source,
      track.level,
      Math.max(CUT_SECONDS, fadeSeconds),
    )
  }
}
