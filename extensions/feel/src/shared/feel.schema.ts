// `feel.toml`: the hard limits, the squash spring and the entries that answer sim events. An entry's
// `on` is a sim event id or a pattern with `*` (any run of characters). Channels: `camera` (a trauma 0..1), `pose` (a hit-stop
// that holds a view's pose), `visual` (a flash, a tint or a squash), `word` (a locale key, never a literal string), `haptic`
// and `audio` (a cue id). Values above a limit are clamped at run time and named by `limitWarnings`.
import { z } from 'zod'

/** How the squash spring moves: its speed in hertz, how much it wobbles and how it starts. */
export interface SpringTuning {
  /** How fast it answers, in hertz. */
  readonly f: number
  /** How much it wobbles: below 1 it overshoots. */
  readonly zeta: number
  /** How it starts: above 1 it anticipates past the target, below 0 it winds up first. */
  readonly r: number
}
/**
 * The hard limits on the effects: the most shake in pixels, the longest hit-stop in milliseconds,
 * and the most flash frames and flash opacity. Values above a limit are clamped when played and
 * named by `limitWarnings`.
 */
export interface Limits {
  readonly shake_px: number
  readonly hit_stop_ms: number
  readonly flash_frames: number
  readonly flash_alpha: number
}
/** The limits used when `feel.toml` sets none. */
export const DEFAULT_LIMITS: Limits = { shake_px: 3, hit_stop_ms: 120, flash_frames: 3, flash_alpha: 0.85 }

/** A camera shake an entry causes. */
export interface CameraRow {
  /** Trauma 0..1: the shake is its square. */
  readonly shake: number
}
/**
 * A hit-stop: the view's pose is held for this many milliseconds, and `target: 'subject'` holds
 * only the view the event is about.
 */
export interface PoseRow {
  readonly hit_stop_ms: number
  readonly target?: 'subject' | undefined
}
/** One of a flash (`flash`, `frames`, `alpha`), a tint (`tint`, `ms`, `alpha`) or a squash (`squash`). */
export interface VisualRow {
  readonly flash?: string | undefined
  readonly frames?: number | undefined
  readonly tint?: string | undefined
  readonly ms?: number | undefined
  readonly alpha?: number | undefined
  readonly squash?: number | undefined
}
/**
 * A word that pops up, as a locale key, never as text. It stays up 800 ms unless `ms` says
 * otherwise.
 */
export interface WordRow {
  /** The word's name, unique in the file. */
  readonly key: string
  /** What it says, in the game's source language. Translatable text in the `feel` content kind. */
  readonly words?: string | undefined
  readonly at?: 'subject' | undefined
  /** How long it stays up; 800 ms when unset. */
  readonly ms?: number | undefined
}
/**
 * A rumble for a game pad (strong and weak motors, in milliseconds) and, optionally, a single buzz
 * for a phone.
 */
export interface HapticRow {
  readonly strong: number
  readonly weak: number
  readonly ms: number
  /** A phone's single buzz; none for an entry without it. */
  readonly phone_ms?: number | undefined
}
/** An audio cue to play, named by its id. */
export interface AudioRow {
  readonly cue: string
}
/**
 * How one sim event feels. `on` is an event id or a pattern with `*` for any run of characters,
 * and the channels say what happens: camera, pose, visual, word, haptic and audio.
 */
export interface FeelEntry {
  readonly on: string
  readonly camera?: readonly CameraRow[] | undefined
  readonly pose?: readonly PoseRow[] | undefined
  readonly visual?: readonly VisualRow[] | undefined
  readonly word?: readonly WordRow[] | undefined
  readonly haptic?: readonly HapticRow[] | undefined
  readonly audio?: readonly AudioRow[] | undefined
}
/** The whole `feel.toml`: the limits, the squash spring and the entries that answer sim events. */
export interface FeelContent {
  readonly limits?: { readonly [K in keyof Limits]?: Limits[K] | undefined } | undefined
  readonly springs?: { readonly squash?: SpringTuning | undefined } | undefined
  readonly entry?: readonly FeelEntry[] | undefined
}

const unit = z.number().min(0).max(1)
const spring: z.ZodType<SpringTuning> = z.strictObject({
  f: z.number().positive(),
  zeta: z.number().min(0),
  r: z.number(),
})
const visual: z.ZodType<VisualRow> = z
  .strictObject({
    flash: z.string().min(1).optional(),
    frames: z.number().int().min(1).optional(),
    tint: z.string().min(1).optional(),
    ms: z.number().positive().optional(),
    alpha: unit.optional(),
    squash: z.number().positive().optional(),
  })
  .superRefine((row, ctx) => {
    const kinds = [row.flash, row.tint, row.squash].filter((x) => x !== undefined).length
    if (kinds !== 1)
      ctx.addIssue({ code: 'custom', path: [], message: 'a visual row is one of flash, tint or squash' })
    if (row.flash !== undefined && row.frames === undefined)
      ctx.addIssue({ code: 'custom', path: ['frames'], message: 'a flash needs its frames' })
    if (row.tint !== undefined && (row.ms === undefined || row.alpha === undefined))
      ctx.addIssue({ code: 'custom', path: ['ms'], message: 'a tint needs its ms and alpha' })
  })
/** An entry's shape; the content kind passes its own schema for a word's `words` (translatable text), the default plain text. */
const entryWith = (words: z.ZodType<string, string>): z.ZodType<FeelEntry> =>
  z.strictObject({
    on: z.string().min(1),
    camera: z.array(z.strictObject({ shake: unit })).optional(),
    pose: z
      .array(z.strictObject({ hit_stop_ms: z.number().positive(), target: z.literal('subject').optional() }))
      .optional(),
    visual: z.array(visual).optional(),
    word: z
      .array(
        z.strictObject({
          key: z.string().min(1),
          words: words.optional(),
          at: z.literal('subject').optional(),
          ms: z.number().positive().optional(),
        }),
      )
      .optional(),
    haptic: z
      .array(
        z.strictObject({
          strong: unit,
          weak: unit,
          ms: z.number().positive(),
          phone_ms: z.number().positive().optional(),
        }),
      )
      .optional(),
    audio: z.array(z.strictObject({ cue: z.string().min(1) })).optional(),
  })

/** The Zod schema of `feel.toml`, with `words` checked by `words`: plain text here, translatable text in the content kind. */
export const feelSchemaWith = (words: z.ZodType<string, string>): z.ZodType<FeelContent> => {
  const entry = entryWith(words)
  return z
    .strictObject({
      limits: z
        .strictObject({
          shake_px: z.number().min(0).optional(),
          hit_stop_ms: z.number().min(0).optional(),
          flash_frames: z.number().int().min(0).optional(),
          flash_alpha: unit.optional(),
        })
        .optional(),
      springs: z.strictObject({ squash: spring.optional() }).optional(),
      entry: z.array(entry).optional(),
    })
    .superRefine((feel, ctx) => {
      const seen = new Set<string>()
      ;(feel.entry ?? []).forEach((e, i) => {
        if (seen.has(e.on))
          ctx.addIssue({ code: 'custom', path: ['entry', i, 'on'], message: `two entries answer ${e.on}` })
        seen.add(e.on)
      })
    })
}
/** The Zod schema of `feel.toml`. */
export const feelSchema: z.ZodType<FeelContent> = feelSchemaWith(z.string())

/** The limits a file sets over the defaults. */
export const resolveLimits = (feel: Pick<FeelContent, 'limits'>): Limits => ({
  shake_px: feel.limits?.shake_px ?? DEFAULT_LIMITS.shake_px,
  hit_stop_ms: feel.limits?.hit_stop_ms ?? DEFAULT_LIMITS.hit_stop_ms,
  flash_frames: feel.limits?.flash_frames ?? DEFAULT_LIMITS.flash_frames,
  flash_alpha: feel.limits?.flash_alpha ?? DEFAULT_LIMITS.flash_alpha,
})

/** Each value above a limit, named by entry; the runtime clamps it anyway. */
export function limitWarnings(feel: FeelContent): string[] {
  const limits = resolveLimits(feel)
  const out: string[] = []
  for (const e of feel.entry ?? []) {
    for (const p of e.pose ?? [])
      if (p.hit_stop_ms > limits.hit_stop_ms)
        out.push(`entry ${e.on}: hit_stop_ms ${p.hit_stop_ms} is above the limit ${limits.hit_stop_ms}`)
    for (const v of e.visual ?? []) {
      if (v.flash === undefined) continue
      if ((v.frames ?? 0) > limits.flash_frames)
        out.push(`entry ${e.on}: flash frames ${v.frames} is above the limit ${limits.flash_frames}`)
      if ((v.alpha ?? 0) > limits.flash_alpha)
        out.push(`entry ${e.on}: flash alpha ${v.alpha} is above the limit ${limits.flash_alpha}`)
    }
  }
  return out
}
