// `audio` content: cues and beds as data, the game-event to cue map, the ducking rules, and the music slots
// and rules. A cue is a recipe of voices a synth schedules on any `BaseAudioContext`: an oscillator swept exponentially
// from `from` to `to` Hz, or seeded noise through a band-pass at `hiss` Hz (a `[low, high]` pair picks its centre each time). The
// buses are core's. Every reference is checked at its path.
import { z } from 'zod'

/** One of the four audio buses: music, sfx, ui and voice. */
export type BusId = 'music' | 'sfx' | 'ui' | 'voice'
/** Every audio bus, in order. */
export const BUSES: readonly BusId[] = ['music', 'sfx', 'ui', 'voice']
/** The shape of a tone: sine, square, sawtooth or triangle. */
export type Wave = 'sine' | 'square' | 'sawtooth' | 'triangle'
/** Every tone shape. */
export const WAVES: readonly Wave[] = ['sine', 'square', 'sawtooth', 'triangle']

/** A tone (`tone`, `from`, `to`) or a hiss (`hiss`, `q`), `at` seconds in, `length` long, at `volume`. */
export interface Voice {
  readonly tone?: Wave | undefined
  readonly from?: number | undefined
  readonly to?: number | undefined
  readonly hiss?: number | readonly [number, number] | undefined
  readonly q?: number | undefined
  readonly at?: number | undefined
  readonly length: number
  readonly volume: number
}
/**
 * A short sound as a recipe of voices, played on a bus. A world cue is panned and made quieter
 * with distance from the listener, and a draft cue is a placeholder until the audio pass replaces
 * it.
 */
export interface Cue {
  readonly id: string
  /** One line: what the player hears, and when. */
  readonly about?: string | undefined
  readonly bus: BusId
  readonly voices: readonly Voice[]
  /** A core sound alias played through `Audio.sound` in place of the voices once it is loaded. */
  readonly sound?: string | undefined
  /** A world sound: panned and attenuated from the listener when the caller passes a position. */
  readonly world?: boolean | undefined
  /** Played on its bus without the ducking that bus normally causes. */
  readonly no_duck?: boolean | undefined
  /** Not final: a placeholder until the audio pass replaces it. */
  readonly draft?: boolean | undefined
}
/** A looping bed: steady drones, optional filtered noise and an optional slow pulse. */
export interface Bed {
  readonly id: string
  readonly about?: string | undefined
  readonly bus: BusId
  /** The bed's own gain, before its fade and bus. */
  readonly volume: number
  readonly drones: readonly {
    readonly wave: Wave
    readonly freq: number
    readonly volume?: number | undefined
  }[]
  readonly noise?: { readonly freq: number; readonly q: number; readonly volume: number } | undefined
  /** Amplitude pulse: `rate` Hz, `depth` 0..1. */
  readonly pulse?: { readonly rate: number; readonly depth: number } | undefined
  readonly draft?: boolean | undefined
}
/** A sim event id or a `*` pattern, and the cue it plays or the reason it plays none. */
export interface EventRow {
  readonly on: string
  readonly cue?: string | undefined
  readonly silent?: string | undefined
}
/** While a cue on `bus` plays, each bus in `duck` drops by `db`, then recovers. */
export interface DuckRule {
  readonly bus: BusId
  readonly duck: readonly BusId[]
  readonly db: number
  readonly attack: number
  readonly release: number
}
/** The colour a music file can be given. Only `radio` exists. */
export type FilterId = 'radio'
/**
 * The cut-off frequencies of each filter: `radio` removes everything below 450 Hz and above 3000
 * Hz.
 */
export const FILTERS: Readonly<Record<FilterId, { readonly highpass: number; readonly lowpass: number }>> = {
  radio: { highpass: 450, lowpass: 3000 },
}
/** A music file standing in for a slot: `volume` multiplies the slot's, `filter` colours it. */
export interface Fallback {
  readonly sound: string
  readonly volume?: number | undefined
  readonly filter?: FilterId | undefined
}
/**
 * One piece of music the game can switch to. It loops or plays once, has a level, and may fade in,
 * cross-fade at its seam, delay, linger after its state ends or be a place of relief.
 */
export interface Slot {
  readonly id: string
  readonly about?: string | undefined
  /** `loop` repeats until the state moves on; `once` plays through and then the slot is silent until it is wanted again. */
  readonly mode: 'loop' | 'once'
  /** Its level, 0..1, before the music bus's volume setting. */
  readonly volume: number
  /** The core sound alias of its own file; its id when unset. */
  readonly sound?: string | undefined
  /** Seconds to crossfade in (2 by default). */
  readonly fade?: number | undefined
  /** Seconds of crossfade at a loop's seam. */
  readonly seam?: number | undefined
  /** Seconds before it starts to sound, so an effect on the same moment lands first. */
  readonly delay?: number | undefined
  /** A place of relief: a chase does not linger into it. */
  readonly relief?: boolean | undefined
  /** Diegetic: its file runs on while the slot is not heard. */
  readonly resume?: boolean | undefined
  /** Seconds the slot holds after its state ends, in play only. */
  readonly linger?: number | undefined
  /** The placeholders to play while the slot's own file does not exist, best first. */
  readonly fallback?: readonly Fallback[] | undefined
}
/** A value a music rule can test: text, a number or a yes-or-no. */
export type StateValue = string | number | boolean
/**
 * What a music rule asks of one key of the game's state: an exact value, one of a list, or within
 * `atLeast` and `atMost`.
 */
export type Condition =
  | StateValue
  | readonly StateValue[]
  | { readonly atMost?: number | undefined; readonly atLeast?: number | undefined }
/**
 * Picks a music slot when every key in `when` holds. The slot is a slot id, `hold` to keep what
 * plays or `silence` to play nothing.
 */
export interface MusicRule {
  /** Every named key must hold: equal to a value, one of a list, or within `atLeast`/`atMost`. */
  readonly when: Readonly<Record<string, Condition>>
  /** A slot id, `hold` (keep what plays) or `silence` (play nothing). */
  readonly slot: string
  readonly why?: string | undefined
}
/**
 * A game's whole `audio` content: master gain, cues, beds, the map from sim events to cues, the
 * ducking rules, and the music slots and rules.
 */
export interface AudioContent {
  readonly master_gain?: number | undefined
  readonly cue?: readonly Cue[] | undefined
  readonly bed?: readonly Bed[] | undefined
  readonly event?: readonly EventRow[] | undefined
  readonly duck?: readonly DuckRule[] | undefined
  readonly slot?: readonly Slot[] | undefined
  readonly music_rule?: readonly MusicRule[] | undefined
}

const bus = z.enum(BUSES as [BusId, ...BusId[]])
const wave = z.enum(WAVES as [Wave, ...Wave[]])
const voice: z.ZodType<Voice> = z
  .strictObject({
    tone: wave.optional(),
    from: z.number().positive().optional(),
    to: z.number().positive().optional(),
    hiss: z
      .union([z.number().positive(), z.tuple([z.number().positive(), z.number().positive()])])
      .optional(),
    q: z.number().positive().optional(),
    at: z.number().min(0).optional(),
    length: z.number().positive(),
    volume: z.number().min(0),
  })
  .superRefine((v, ctx) => {
    const kinds = (v.tone !== undefined ? 1 : 0) + (v.hiss !== undefined ? 1 : 0)
    if (kinds !== 1) ctx.addIssue({ code: 'custom', path: [], message: 'a voice is a tone or a hiss' })
    else if (v.tone !== undefined && (v.from === undefined || v.to === undefined))
      ctx.addIssue({ code: 'custom', path: [], message: 'a tone needs its from and to' })
  })
const cue: z.ZodType<Cue> = z.strictObject({
  id: z.string().min(1),
  about: z.string().optional(),
  bus,
  voices: z.array(voice),
  sound: z.string().min(1).optional(),
  world: z.boolean().optional(),
  no_duck: z.boolean().optional(),
  draft: z.boolean().optional(),
})
const bed: z.ZodType<Bed> = z.strictObject({
  id: z.string().min(1),
  about: z.string().optional(),
  bus,
  volume: z.number().min(0),
  drones: z
    .array(z.strictObject({ wave, freq: z.number().positive(), volume: z.number().min(0).optional() }))
    .min(1),
  noise: z
    .strictObject({ freq: z.number().positive(), q: z.number().positive(), volume: z.number().min(0) })
    .optional(),
  pulse: z.strictObject({ rate: z.number().positive(), depth: z.number().min(0).max(1) }).optional(),
  draft: z.boolean().optional(),
})
const eventRow: z.ZodType<EventRow> = z
  .strictObject({
    on: z.string().min(1),
    cue: z.string().min(1).optional(),
    silent: z.string().min(1).optional(),
  })
  .superRefine((e, ctx) => {
    if ((e.cue !== undefined) === (e.silent !== undefined))
      ctx.addIssue({
        code: 'custom',
        path: [],
        message: 'an event plays a cue or is silent with a reason, not both or neither',
      })
  })
const duckRule: z.ZodType<DuckRule> = z.strictObject({
  bus,
  duck: z.array(bus),
  db: z.number().max(0),
  attack: z.number().min(0),
  release: z.number().min(0),
})
const slot: z.ZodType<Slot> = z.strictObject({
  id: z.string().min(1),
  about: z.string().optional(),
  mode: z.enum(['loop', 'once']),
  volume: z.number().min(0).max(1),
  sound: z.string().min(1).optional(),
  fade: z.number().min(0).optional(),
  seam: z.number().min(0).optional(),
  delay: z.number().min(0).optional(),
  relief: z.boolean().optional(),
  resume: z.boolean().optional(),
  linger: z.number().min(0).optional(),
  fallback: z
    .array(
      z.strictObject({
        sound: z.string().min(1),
        volume: z.number().min(0).optional(),
        filter: z.literal('radio').optional(),
      }),
    )
    .optional(),
})
const stateValue = z.union([z.string(), z.number(), z.boolean()])
const musicRule: z.ZodType<MusicRule> = z.strictObject({
  when: z.record(
    z.string(),
    z.union([
      stateValue,
      z.array(stateValue),
      z.strictObject({ atMost: z.number().optional(), atLeast: z.number().optional() }),
    ]),
  ),
  slot: z.string().min(1),
  why: z.string().optional(),
})

/**
 * The Zod schema of the `audio` content. Every reference (a cue an event plays, a slot a rule
 * picks) is checked at its path.
 */
export const audioSchema: z.ZodType<AudioContent> = z
  .strictObject({
    master_gain: z.number().min(0).max(1).optional(),
    cue: z.array(cue).optional(),
    bed: z.array(bed).optional(),
    event: z.array(eventRow).optional(),
    duck: z.array(duckRule).optional(),
    slot: z.array(slot).optional(),
    music_rule: z.array(musicRule).optional(),
  })
  .superRefine((audio, ctx) => {
    const sounds = new Set<string>()
    const note = (list: string, i: number, id: string): void => {
      if (sounds.has(id))
        ctx.addIssue({ code: 'custom', path: [list, i, 'id'], message: `${id} is listed twice` })
      sounds.add(id)
    }
    ;(audio.cue ?? []).forEach((c, i) => {
      note('cue', i, c.id)
    })
    ;(audio.bed ?? []).forEach((b, i) => {
      note('bed', i, b.id)
    })
    const cues = new Set((audio.cue ?? []).map((c) => c.id))
    const seen = new Set<string>()
    ;(audio.event ?? []).forEach((e, i) => {
      if (e.cue !== undefined && !cues.has(e.cue))
        ctx.addIssue({ code: 'custom', path: ['event', i, 'cue'], message: `no cue ${e.cue}` })
      if (seen.has(e.on))
        ctx.addIssue({ code: 'custom', path: ['event', i, 'on'], message: `two entries answer ${e.on}` })
      seen.add(e.on)
    })
    const slots = new Set<string>()
    ;(audio.slot ?? []).forEach((s, i) => {
      if (slots.has(s.id))
        ctx.addIssue({ code: 'custom', path: ['slot', i, 'id'], message: `slot ${s.id} is listed twice` })
      slots.add(s.id)
    })
    ;(audio.music_rule ?? []).forEach((r, i) => {
      if (r.slot !== 'hold' && r.slot !== 'silence' && !slots.has(r.slot))
        ctx.addIssue({ code: 'custom', path: ['music_rule', i, 'slot'], message: `no slot ${r.slot}` })
    })
  })
