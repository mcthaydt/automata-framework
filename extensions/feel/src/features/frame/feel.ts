// The feel runtime: sim events in, a `FeelFrame` of plain data out, once per drawn frame. It hears
// `sim.events` and the settings and never writes the sim, sends a command or changes a tick (law 1): a hit-stop freezes
// *views*, never positions. An event is answered when the drawn picture reaches its tick, once, so a feel never lands before
// the picture shows its cause. Noise is a hash of integers and time is the sum of the frame times it is given (the presentation
// clock, read through `frameNow`; `fakeClock()` in tests), so a frame is a pure function of the events, the drawn tick, the
// settings and the frame times. Reduced motion and the settings are read live, on every frame, so they apply on the next one.
import type { Clock } from '@automata/framework'
import type { SimEvent } from '@automata/sim'
import { Beats } from '../../shared/dynamics/beats'
import { HitStop } from '../../shared/dynamics/hit-stop'
import { SquashBook } from '../../shared/dynamics/squash'
import { Trauma } from '../../shared/dynamics/trauma'
import { type FeelContent, type FeelEntry, resolveLimits, type SpringTuning } from '../../shared/feel.schema'

/** A view the sim names, by its stable id. */
export type EntityRef = number

export interface FeelSettings {
  /** Drops flash and flicker. */
  readonly reduceFlashing: boolean
  /** The player's rumble switch. */
  readonly haptics: boolean
  /** Scales camera and pose effects: shake, hit-stop length and squash. */
  readonly intensity: 0 | 0.5 | 1
}
export const DEFAULT_SETTINGS: FeelSettings = { reduceFlashing: false, haptics: true, intensity: 1 }

export interface WordPop {
  /** A locale key. */
  readonly key: string
  readonly at: EntityRef | null
  /** Seconds since it popped. */
  readonly age: number
  /** Reduced motion: it appears, still. */
  readonly still: boolean
}
export interface Pulse {
  readonly strong: number
  readonly weak: number
  readonly ms: number
  readonly phoneMs?: number | undefined
}
export interface FeelFrame {
  /** Whole pixels (2D) or screen pixels (3D). */
  readonly offset: readonly [number, number]
  /** Hit-stop: these views hold their pose. */
  readonly frozen: readonly EntityRef[]
  readonly flash: { readonly colour: string; readonly alpha: number } | null
  readonly tint: { readonly colour: string; readonly alpha: number } | null
  /** Scale x, y on 1/32 steps, for each view not at rest. */
  readonly squash: ReadonlyMap<EntityRef, readonly [number, number]>
  readonly words: readonly WordPop[]
  /** The rumbles that fire on this frame, once (the haptics port plays them). */
  readonly haptics: readonly Pulse[]
  /** The audio cues that fire on this frame, once. */
  readonly cues: readonly string[]
}

export interface FeelOptions {
  /** The feel table; read at each event, so a reload shows on the next one. */
  readonly content: () => FeelContent
  readonly settings: () => FeelSettings
  /** The player's reduced-motion preference, read every frame. */
  readonly reducedMotion: () => boolean
  readonly seed?: number | undefined
  /** The most ticks behind the picture an event is still answered (default 30). */
  readonly staleTicks?: number | undefined
  /** The presentation clock `frameNow` reads its frame times from; tests hand over `fakeClock()`. */
  readonly clock: Clock
}
export interface Feel {
  /** The events the step at `tick` produced (the game's loop passes them as it gets them: FE-D1). */
  hear(tick: number, events: readonly SimEvent[]): void
  /** The frame to draw: `frameSeconds` after the last. */
  frame(drawnTick: number, alpha: number, frameSeconds: number): FeelFrame
  /** The same, its seconds read from the clock: the time since the last call, or 0 on the first. */
  frameNow(drawnTick: number, alpha: number): FeelFrame
}

const FPS = 60
const WORD_MS = 800
const TRAUMA_DECAY = 1.6
const DEFAULT_SQUASH: SpringTuning = { f: 4, zeta: 0.35, r: 0 }
const stepped = (p: number, steps: number): number => Math.min(1, Math.ceil(Math.max(0, p) * steps) / steps)

/** `*` matches any run of characters. */
export const matches = (pattern: string, event: string): boolean =>
  new RegExp(
    `^${pattern
      .split('*')
      .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('.+')}$`,
  ).test(event)

/** The view an event is about: its payload's `entity` or `subject`. */
function subjectOf(event: SimEvent): EntityRef | null {
  const p = event.payload as { entity?: unknown; subject?: unknown } | null
  const id = p?.entity ?? p?.subject
  return typeof id === 'number' ? id : null
}

export function createFeel(options: FeelOptions): Feel {
  const seed = options.seed ?? 1
  const beats = new Beats({ staleTicks: options.staleTicks })
  const trauma = new Trauma()
  const squash = new SquashBook(() => options.content().springs?.squash ?? DEFAULT_SQUASH)
  const stops = new Map<EntityRef, HitStop>()
  let t = 0
  let flash: { colour: string; alpha: number; until: number } | null = null
  let tint: { colour: string; alpha: number; born: number; ms: number } | null = null
  let words: { key: string; at: EntityRef | null; born: number; ms: number }[] = []
  let lastNow: number | null = null

  const frozenViews = (): EntityRef[] =>
    [...stops]
      .filter(([, stop]) => stop.frozen(t * 1000))
      .map(([id]) => id)
      .sort((a, b) => a - b)

  function fire(
    entry: FeelEntry,
    subject: EntityRef | null,
    still: boolean,
    out: { haptics: Pulse[]; cues: string[] },
  ): void {
    const settings = options.settings()
    const limits = resolveLimits(options.content())
    const k = settings.intensity
    if (!still && k > 0) {
      for (const row of entry.camera ?? []) trauma.add(row.shake * k)
      for (const row of entry.pose ?? []) {
        const ms = Math.min(row.hit_stop_ms * k, limits.hit_stop_ms)
        if (subject === null || ms <= 0) continue
        let stop = stops.get(subject)
        if (stop === undefined) {
          stop = new HitStop()
          stops.set(subject, stop)
        }
        stop.start(t * 1000, ms)
      }
    }
    for (const row of entry.visual ?? []) {
      if (row.flash !== undefined && !settings.reduceFlashing) {
        const frames = Math.min(row.frames ?? 1, limits.flash_frames)
        const alpha = Math.min(row.alpha ?? limits.flash_alpha, limits.flash_alpha)
        if (frames > 0)
          flash = { colour: row.flash, alpha: Math.max(alpha, flash?.alpha ?? 0), until: t + frames / FPS }
      } else if (row.tint !== undefined && row.ms !== undefined)
        tint = { colour: row.tint, alpha: row.alpha ?? 1, born: t, ms: row.ms }
      else if (row.squash !== undefined && !still && k > 0 && subject !== null)
        squash.knock(subject, row.squash * k)
    }
    for (const row of entry.word ?? [])
      words.push({ key: row.key, at: row.at === 'subject' ? subject : null, born: t, ms: row.ms ?? WORD_MS })
    if (settings.haptics)
      for (const row of entry.haptic ?? [])
        out.haptics.push({ strong: row.strong, weak: row.weak, ms: row.ms, phoneMs: row.phone_ms })
    for (const row of entry.audio ?? []) out.cues.push(row.cue)
  }

  function frame(drawnTick: number, _alpha: number, frameSeconds: number): FeelFrame {
    const dt = Math.max(0, frameSeconds)
    t += dt
    const still = options.reducedMotion()
    if (still) {
      trauma.settle()
      squash.settle()
      for (const stop of stops.values()) stop.settle()
    } else {
      trauma.update(dt, TRAUMA_DECAY)
      squash.update(dt, new Set(frozenViews()))
    }
    const out = { haptics: [] as Pulse[], cues: [] as string[] }
    for (const { event } of beats.reach(drawnTick))
      for (const entry of options.content().entry ?? [])
        if (matches(entry.on, event.type)) fire(entry, subjectOf(event), still, out)

    const settings = options.settings()
    const limits = resolveLimits(options.content())
    if (flash !== null && (t >= flash.until - 1e-9 || settings.reduceFlashing)) flash = null
    if (tint !== null && (t - tint.born) * 1000 >= tint.ms) tint = null
    words = words.filter((w) => (t - w.born) * 1000 < w.ms)
    const frozen = still ? [] : frozenViews()
    return {
      offset:
        still || settings.intensity === 0
          ? [0, 0]
          : trauma.offset(limits.shake_px, seed, Math.floor((t * FPS) / 2)),
      frozen,
      flash: flash === null ? null : { colour: flash.colour, alpha: flash.alpha },
      tint:
        tint === null
          ? null
          : { colour: tint.colour, alpha: tint.alpha * (1 - stepped(((t - tint.born) * 1000) / tint.ms, 6)) },
      squash: new Map(squash.scales().map(([id, s]) => [id as EntityRef, [s.x, s.y] as const])),
      words: words.map((w) => ({ key: w.key, at: w.at, age: t - w.born, still })),
      haptics: out.haptics,
      cues: out.cues,
    }
  }

  return {
    hear: (tick, events) => beats.noteAt(tick, events),
    frame,
    frameNow: (drawnTick, alpha) => {
      const now = options.clock.now()
      const dt = lastNow === null ? 0 : (now - lastNow) / 1000
      lastNow = now
      return frame(drawnTick, alpha, dt)
    },
  }
}
