// Offline renders: a cue, a bed, a mix of cues over a bed, and the
// ducking probe, each through the synth and mixer on an `OfflineAudioContext`, with a seeded random so a render is the
// same every time. Node has no Web Audio, so these run where one exists (Chromium, for the pipeline); the caller gives the
// factory that builds the context. Each returns the channels as `Float32Array`s.
import type { AudioContent, BusId, Cue } from '../../shared/audio.schema'
import { BUSES } from '../../shared/audio.schema'
import { createMixer, type Listener, type MixerPort } from '../../shared/mixer'
import { startBed } from '../../shared/synth'

/** The sample rate offline renders use: 48000 Hz. */
export const SAMPLE_RATE = 48000

/** The part of `OfflineAudioContext` a render needs. */
export interface OfflineLike extends BaseAudioContext {
  startRendering(): Promise<{ getChannelData(channel: number): Float32Array }>
}
/**
 * What an offline render needs from the page: a function that makes an offline audio context, and
 * optionally a sample rate.
 */
export interface RenderEnv {
  /** `(channels, frames, sampleRate) => new OfflineAudioContext(...)`. */
  readonly make: (channels: number, frames: number, rate: number) => OfflineLike
  readonly rate?: number
}

/** A seeded random (mulberry32), so a crackle renders the same every time. */
export function seeded(seed = 1): () => number {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** How long a duck takes to let go after its hold, in seconds. */
export interface OfflinePortOptions {
  /** Seconds a duck takes to let go after its hold (the rule's release is not part of the port's call). */
  readonly release?: number
}
/** The port's attack in seconds: a duck reaches its depth this fast. */
const DUCK_ATTACK = 0.05
/**
 * A mixer port for an offline render. Set `at` to the context time before each `play` so ducks
 * start there.
 */
export interface OfflinePort extends MixerPort {
  /** The context time ducks start at; set before each `play` (a render schedules everything before it starts). */
  at: number | undefined
}

/**
 * Core's buses for an offline render: a gain per bus into the destination, and ducks as gain automation. Ducks do not nest:
 * overlapping ducks on one bus each automate the same param, the last scheduled winning where they cross.
 */
export function offlinePort(ctx: BaseAudioContext, { release = 0.3 }: OfflinePortOptions = {}): OfflinePort {
  const gains = new Map<BusId, GainNode>()
  const input = (bus: BusId): GainNode => {
    let g = gains.get(bus)
    if (g === undefined) {
      g = ctx.createGain()
      g.connect(ctx.destination)
      gains.set(bus, g)
    }
    return g
  }
  for (const bus of BUSES) input(bus)
  const port: OfflinePort = {
    at: undefined,
    input,
    duck(bus, amount, seconds) {
      const g = input(bus).gain
      const t = port.at ?? ctx.currentTime
      const low = 1 - amount
      g.setValueAtTime(1, t)
      g.linearRampToValueAtTime(low, t + DUCK_ATTACK)
      g.setValueAtTime(low, t + seconds)
      g.linearRampToValueAtTime(1, t + seconds + release)
    },
  }
  return port
}

const frames = (seconds: number, rate: number): number => Math.ceil(seconds * rate)
const rateOf = (env: RenderEnv): number => env.rate ?? SAMPLE_RATE
const channelsOf = async (ctx: OfflineLike, count: number): Promise<Float32Array[]> => {
  const buffer = await ctx.startRendering()
  return Array.from({ length: count }, (_, c) => buffer.getChannelData(c))
}
const cueOf = (content: AudioContent, id: string): Cue => {
  const cue = (content.cue ?? []).find((c) => c.id === id)
  if (cue === undefined)
    throw new Error(`no cue "${id}"; cues: ${(content.cue ?? []).map((c) => c.id).join(', ')}`)
  return cue
}
const bedOf = (content: AudioContent, id: string) => {
  const bed = (content.bed ?? []).find((b) => b.id === id)
  if (bed === undefined)
    throw new Error(`no bed "${id}"; beds: ${(content.bed ?? []).map((b) => b.id).join(', ')}`)
  return bed
}

/**
 * How to render one cue: how many seconds, and optionally where it sounds and where the listener
 * is, for a world cue.
 */
export interface CueRenderOptions {
  readonly seconds: number
  /** Where the cue sounds and where the listener is, to render it panned and attenuated (a world cue only). */
  readonly place?:
    | { readonly at: { readonly x: number; readonly z: number }; readonly listener: Listener }
    | undefined
}

/** One cue through the mixer, alone. */
export async function renderCue(
  env: RenderEnv,
  content: AudioContent,
  id: string,
  options: CueRenderOptions,
): Promise<Float32Array[]> {
  const cue = cueOf(content, id)
  const rate = rateOf(env)
  const ctx = env.make(2, frames(options.seconds, rate), rate)
  const port = offlinePort(ctx)
  const mixer = createMixer({ port, ducks: content.duck ?? [] })
  if (options.place !== undefined) mixer.listener(options.place.listener)
  port.at = 0
  mixer.play(cue, { when: 0, random: seeded(), at: options.place?.at })
  return channelsOf(ctx, 2)
}

/** A bed for `seconds`. */
export async function renderBed(
  env: RenderEnv,
  content: AudioContent,
  id: string,
  seconds: number,
): Promise<Float32Array[]> {
  const bed = bedOf(content, id)
  const rate = rateOf(env)
  const ctx = env.make(2, frames(seconds, rate), rate)
  startBed(ctx, offlinePort(ctx).input(bed.bus), bed)
  return channelsOf(ctx, 2)
}

/** A mix to render: its length in seconds, the bed under it and the cues to play at which times. */
export interface MixSpec {
  readonly seconds: number
  readonly bed: string | null
  readonly sequence: readonly { readonly t: number; readonly cue: string }[]
}

/** A sequence of cues over a bed: the bus and gameplay mix the loudness targets apply to. */
export async function renderMix(
  env: RenderEnv,
  content: AudioContent,
  mix: MixSpec,
): Promise<Float32Array[]> {
  const rate = rateOf(env)
  const ctx = env.make(2, frames(mix.seconds, rate), rate)
  const port = offlinePort(ctx)
  const mixer = createMixer({ port, ducks: content.duck ?? [] })
  const random = seeded()
  if (mix.bed !== null) {
    const bed = bedOf(content, mix.bed)
    startBed(ctx, port.input(bed.bus), bed)
  }
  for (const s of mix.sequence) {
    port.at = s.t
    mixer.play(cueOf(content, s.cue), { when: s.t, random })
  }
  return channelsOf(ctx, 2)
}

/**
 * How to render the ducking demonstration: its length, when the line starts, which cue is the line
 * and which bed to listen on.
 */
export interface DuckRenderOptions {
  readonly seconds: number
  /** When the line starts. */
  readonly at: number
  /** The cue that ducks, or `null` for the same render with nothing to duck it. */
  readonly line: string | null
  /** The bed to listen to ducking on; the first bed by default. */
  readonly bed?: string | undefined
}

/** A bed, with `line` played at `at`: the ducking demonstration. */
export async function renderDuck(
  env: RenderEnv,
  content: AudioContent,
  options: DuckRenderOptions,
): Promise<Float32Array[]> {
  const rate = rateOf(env)
  const ctx = env.make(2, frames(options.seconds, rate), rate)
  const port = offlinePort(ctx)
  const mixer = createMixer({ port, ducks: content.duck ?? [] })
  const bed = (content.bed ?? []).find((b) => b.id === options.bed) ?? (content.bed ?? [])[0]
  if (bed !== undefined) startBed(ctx, port.input(bed.bus), bed)
  if (options.line !== null) {
    port.at = options.at
    mixer.play(cueOf(content, options.line), { when: options.at, random: seeded() })
  }
  return channelsOf(ctx, 2)
}
