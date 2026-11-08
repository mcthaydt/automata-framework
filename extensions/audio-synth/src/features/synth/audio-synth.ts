// The audio-synth driver: sim events in, cues out. It hears `sim.events` and answers each when the
// drawn picture reaches its tick, once, by the first row of the event map that matches (`feel`'s `Beats`, the one holder of
// that rule), so a sound never lands before the picture shows its cause. It never writes the sim. Beds start and stop by id.
// Everything plays through the mixer port the game builds from core's buses (never a second context).
import { Beats, hash, matches } from '@automata/feel'
import type { SimEvent } from '@automata/sim'
import type { AudioContent, Cue, EventRow } from '../../shared/audio.schema'
import { createMixer, type Listener, type MixerPort } from '../../shared/mixer'
import { startBed } from '../../shared/synth'

/**
 * What `createAudioSynth` needs: the audio table (read at each event, so a reload shows), the port
 * into the game's buses, an optional seed and how many ticks behind the picture an event is still
 * answered.
 */
export interface AudioSynthOptions {
  /** The audio table; read at each event, so a reload shows on the next one. */
  readonly content: () => AudioContent
  readonly port: MixerPort
  /** The most ticks behind the picture an event is still answered (default 30). */
  readonly staleTicks?: number | undefined
  readonly seed?: number | undefined
}
/**
 * The audio runtime. Tell it what the sim did with `hear`, play what the picture has reached with
 * `frame`, and start or stop looping beds.
 */
export interface AudioSynth {
  /** The events the step at `tick` produced. */
  hear(tick: number, events: readonly SimEvent[]): void
  /** Plays what the drawn tick has reached. `listener` pans world cues. */
  frame(drawnTick: number, listener?: Listener | null): { readonly played: readonly string[] }
  /** Plays the cue called `id` now, on its bus; false when the table has no such cue. */
  play(id: string, at?: { readonly x: number; readonly z: number }): boolean
  startBed(id: string): void
  stopBed(id: string): void
  /** The beds playing, in the order they started. */
  playing(): string[]
}

/** The first row of the event map that matches `event`. */
export const rowFor = (content: Pick<AudioContent, 'event'>, event: string): EventRow | undefined =>
  (content.event ?? []).find((row) => matches(row.on, event))

/** Where an event happened: its payload's `at` (a point), or its `x` and `z`. */
function placeOf(event: SimEvent): { x: number; z: number } | undefined {
  const p = event.payload as { at?: { x?: unknown; z?: unknown }; x?: unknown; z?: unknown } | null
  const point = p?.at ?? p
  return typeof point?.x === 'number' && typeof point.z === 'number' ? { x: point.x, z: point.z } : undefined
}

/**
 * Starts the audio runtime. Sim events are answered when the drawn picture reaches their tick,
 * once each, with the cue the event map names.
 */
export function createAudioSynth(options: AudioSynthOptions): AudioSynth {
  const beats = new Beats({ staleTicks: options.staleTicks })
  const seed = options.seed ?? 1
  const beds = new Map<string, (at?: number) => void>()
  let n = 0
  const random = (): number => hash(seed, n++)
  return {
    play(id, at) {
      const content = options.content()
      const cue = (content.cue ?? []).find((c) => c.id === id)
      if (cue === undefined) return false
      createMixer({ port: options.port, ducks: content.duck ?? [] }).play(cue, { at, random })
      return true
    },
    hear: (tick, events) => beats.noteAt(tick, events),
    frame(drawnTick, listener = null) {
      const content = options.content()
      const mixer = createMixer({ port: options.port, ducks: content.duck ?? [] })
      mixer.listener(listener)
      const cues = new Map<string, Cue>((content.cue ?? []).map((c) => [c.id, c]))
      const played: string[] = []
      for (const { event } of beats.reach(drawnTick)) {
        const row = rowFor(content, event.type)
        const cue = row?.cue === undefined ? undefined : cues.get(row.cue)
        if (cue === undefined) continue
        mixer.play(cue, { at: placeOf(event), random })
        played.push(cue.id)
      }
      return { played }
    },
    startBed(id) {
      const bed = (options.content().bed ?? []).find((b) => b.id === id)
      if (bed === undefined || beds.has(id)) return
      const into = options.port.input(bed.bus)
      beds.set(id, startBed(into.context as BaseAudioContext, into, bed))
    },
    stopBed(id) {
      const stop = beds.get(id)
      if (stop === undefined) return
      beds.delete(id)
      stop()
    },
    playing: () => [...beds.keys()],
  }
}

/**
 * Whether every event a game can produce is answered: `missing` lists events with no row, and
 * `silent` lists events that are silent on purpose, with the reason.
 */
export interface Coverage {
  readonly ok: boolean
  /** Events a game declares that no row answers. */
  readonly missing: readonly { readonly event: string; readonly from: string }[]
  readonly silent: readonly { readonly event: string; readonly why: string }[]
  readonly events: number
  readonly cued: number
}

/** Every event the game declares, with where it comes from, against the event map: cued, silent with a reason, or missing. */
export function coverage(
  content: Pick<AudioContent, 'event'>,
  wanted: ReadonlyMap<string, string>,
): Coverage {
  const missing: { event: string; from: string }[] = []
  const silent: { event: string; why: string }[] = []
  let cued = 0
  for (const [event, from] of wanted) {
    const row = rowFor(content, event)
    if (row === undefined) missing.push({ event, from })
    else if (row.silent !== undefined) silent.push({ event, why: row.silent })
    else cued += 1
  }
  return { ok: missing.length === 0, missing, silent, events: wanted.size, cued }
}
