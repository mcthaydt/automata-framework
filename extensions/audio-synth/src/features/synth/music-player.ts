// The music player: the tracks a person imported, one at a time, switched with a fade. It plays what the music director
// picks into the music bus (core's `AudioBuses.input('music')`) and never makes a note or a context of its own. A slot's
// `fade` is how the switch sounds, its `delay` holds the start back, and `once` plays through and then waits to be wanted
// again. Decoding is cached by file; a file that will not load is reported and the music that was playing carries on.
import { FILTERS, type Slot } from '../../shared/audio.schema'
import { resolveSlot } from './music'

/** Seconds of crossfade when a slot names none. */
export const DEFAULT_FADE_SECONDS = 2

/** What the player needs: the context and bus input of core's audio graph, and where the tracks' files are. */
export interface MusicPlayerOptions {
  readonly context: BaseAudioContext
  /** `AudioBuses.input('music')`: the node every track connects to. */
  readonly output: AudioNode
  /** The imported tracks: the sound alias (the file's name, as Audio writes it) to the file's address. */
  readonly tracks: Readonly<Record<string, string>>
  /** Fetches a file's bytes. Default: `fetch`. */
  readonly load?: ((url: string) => Promise<ArrayBuffer>) | undefined
  /** Says in words why something would not play. */
  readonly onFault?: ((message: string) => void) | undefined
}

/** Plays the slot the game's state calls for. */
export interface MusicPlayer {
  /** The slot to be hearing now, or `null` for silence. Asked again for the same slot, it does nothing. */
  play(slot: Slot | null): void
  /** The overall volume, 0..1 (`master_gain`): every track plays at its own level times this, and a change is followed at once. */
  setMaster(volume: number): void
  /** The id of the slot being asked for, whether or not it has started yet. */
  wanted(): string | null
  /** Fades out and lets go. */
  dispose(): void
}

interface Playing {
  readonly slot: Slot
  readonly source: AudioBufferSourceNode
  readonly gain: GainNode
  /** The track's own level, before the overall volume. */
  readonly volume: number
}

/** Seconds a change of the overall volume takes, so it is heard as a turn of a knob and not a click. */
const MASTER_RAMP_SECONDS = 0.05

async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  return response.arrayBuffer()
}

const why = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause))

/** Makes the player over core's music bus. */
export function createMusicPlayer(options: MusicPlayerOptions): MusicPlayer {
  const { context, output } = options
  const available = new Set(Object.keys(options.tracks))
  const bytesOf = options.load ?? fetchBytes
  const decoded = new Map<string, Promise<AudioBuffer>>()
  let wanted: Slot | null = null
  let playing: Playing | null = null
  let disposed = false
  let master = 1

  const buffer = (alias: string): Promise<AudioBuffer> => {
    const known = decoded.get(alias)
    if (known !== undefined) return known
    const made = bytesOf(options.tracks[alias] as string).then((bytes) => context.decodeAudioData(bytes))
    decoded.set(alias, made)
    // A failure is not kept, so the next time the slot is wanted it tries again.
    made.catch(() => decoded.delete(alias))
    return made
  }

  const fadeOut = (seconds: number): void => {
    const track = playing
    if (track === null) return
    playing = null
    const now = context.currentTime
    const param = track.gain.gain
    param.cancelScheduledValues(now)
    param.setValueAtTime(param.value, now)
    param.linearRampToValueAtTime(0, now + seconds)
    track.source.stop(now + seconds)
  }

  const start = (slot: Slot, buffered: AudioBuffer, pick: ReturnType<typeof resolveSlot>[number]): void => {
    const now = context.currentTime
    const fade = slot.fade ?? DEFAULT_FADE_SECONDS
    fadeOut(fade)
    const source = context.createBufferSource()
    source.buffer = buffered
    source.loop = slot.mode === 'loop'
    const gain = context.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(pick.volume * master, now + (slot.delay ?? 0) + fade)
    let tail: AudioNode = source
    if (pick.filter !== undefined) {
      const { highpass, lowpass } = FILTERS[pick.filter]
      const high = context.createBiquadFilter()
      high.type = 'highpass'
      high.frequency.value = highpass
      const low = context.createBiquadFilter()
      low.type = 'lowpass'
      low.frequency.value = lowpass
      tail.connect(high)
      high.connect(low)
      tail = low
    }
    tail.connect(gain)
    gain.connect(output)
    // A track that played through is gone; the slot stays wanted, so it does not start over until something else is.
    source.onended = () => {
      if (playing?.source === source) playing = null
      gain.disconnect?.()
    }
    source.start(now + (slot.delay ?? 0))
    playing = { slot, source, gain, volume: pick.volume }
  }

  return {
    play(slot) {
      if (disposed || (slot?.id ?? null) === (wanted?.id ?? null)) return
      wanted = slot
      if (slot === null) {
        fadeOut(playing?.slot.fade ?? DEFAULT_FADE_SECONDS)
        return
      }
      const pick = resolveSlot(slot, available)[0]
      if (pick === undefined) {
        options.onFault?.(`There is no music file for “${slot.id}” yet. Put one in assets/music.`)
        fadeOut(slot.fade ?? DEFAULT_FADE_SECONDS)
        return
      }
      buffer(pick.sound).then(
        (buffered) => {
          if (!disposed && wanted?.id === slot.id) start(slot, buffered, pick)
        },
        (cause: unknown) => {
          if (wanted?.id === slot.id)
            options.onFault?.(`The music “${slot.id}” would not play (${why(cause)}).`)
        },
      )
    },
    setMaster(volume) {
      if (volume === master) return
      master = volume
      if (playing === null) return
      const now = context.currentTime
      const param = playing.gain.gain
      param.cancelScheduledValues(now)
      param.setValueAtTime(param.value, now)
      param.linearRampToValueAtTime(playing.volume * master, now + MASTER_RAMP_SECONDS)
    },
    wanted: () => wanted?.id ?? null,
    dispose() {
      if (disposed) return
      fadeOut(0.05)
      disposed = true
      wanted = null
    },
  }
}
