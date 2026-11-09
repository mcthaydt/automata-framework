// Music slots and rules: which file a slot plays, which slot a game state calls for, and a director that lets a chase
// linger. The rules read a flat state the game fills each frame; the music never feeds back into the sim. The slot's
// crossfade and decoding are core's `MusicSlot` concern; this module only decides what should play.
import type { Condition, FilterId, MusicRule, Slot, StateValue } from '../../shared/audio.schema'

/** What the rules read: a flat record. A key the state lacks never satisfies a condition that names it. */
export type MusicState = Readonly<Record<string, StateValue | null | undefined>>

/** A file that would play for a slot, with its final level. */
export interface Candidate {
  readonly sound: string
  readonly volume: number
  readonly filter?: FilterId
  /** True for a placeholder, false for the slot's own file. */
  readonly placeholder: boolean
}

/** What plays for `slot`, best first: its own file, then each fallback that exists. Empty when none does (silent). */
export function resolveSlot(slot: Slot, available: ReadonlySet<string>): Candidate[] {
  const out: Candidate[] = []
  const own = slot.sound ?? slot.id
  if (available.has(own)) out.push({ sound: own, volume: slot.volume, placeholder: false })
  for (const fallback of slot.fallback ?? []) {
    if (!available.has(fallback.sound)) continue
    const candidate = {
      sound: fallback.sound,
      volume: slot.volume * (fallback.volume ?? 1),
      placeholder: true,
    }
    out.push(fallback.filter === undefined ? candidate : { ...candidate, filter: fallback.filter })
  }
  return out
}

/** Whether `value` satisfies `want`: equal, one of a list, or within `atLeast`/`atMost`. */
export function holds(want: Condition, value: StateValue | null | undefined): boolean {
  if (value === undefined || value === null) return false
  if (typeof want !== 'object') return want === value
  if (Array.isArray(want)) return want.includes(value)
  const range = want as { readonly atMost?: number | undefined; readonly atLeast?: number | undefined }
  if (typeof value !== 'number') return false
  return (
    (range.atMost === undefined || value <= range.atMost) &&
    (range.atLeast === undefined || value >= range.atLeast)
  )
}

const matches = (rule: MusicRule, state: MusicState): boolean => {
  for (const key of Object.keys(rule.when)) if (!holds(rule.when[key] as Condition, state[key])) return false
  return true
}

/** The slot `state` calls for: the first row that matches wins, so the order is the priority. `hold` and `silence` come back as themselves. */
export function slotFor(rules: readonly MusicRule[], state: MusicState): string | undefined {
  return rules.find((rule) => matches(rule, state))?.slot
}

/** The loops the rows play when `state[key]` is `value`, best first: for loading ahead of the scene. */
export function slotsFor(
  rules: readonly MusicRule[],
  slots: readonly Slot[],
  key: string,
  value: StateValue,
): string[] {
  const out: string[] = []
  for (const rule of rules) {
    const want = rule.when[key]
    if (want === undefined || !holds(want, value) || out.includes(rule.slot)) continue
    if (slots.find((s) => s.id === rule.slot)?.mode === 'loop') out.push(rule.slot)
  }
  return out
}

/**
 * Chooses which music slot plays as the game's state changes. `step` moves it forward by some
 * seconds and `slot` is what plays now, or nothing.
 */
export interface MusicDirector {
  /** Steps `dt` seconds with `state`; returns the slot to play (null for none). */
  step(state: MusicState, dt: number): string | null
  readonly slot: string | null
}
/** The slots and rules a music director chooses from. */
export interface MusicDirectorOptions {
  readonly slots: readonly Slot[]
  readonly rules: readonly MusicRule[]
}

/**
 * Turns the rows' answer into the slot to play. A slot with a `linger` holds that many seconds after its state ends, so a
 * pursuer losing the player for a moment does not cut the chase. Silence and a `relief` slot take over at once, and `hold`
 * (an overlay) keeps what plays and leaves the linger clock where it was. Every other change is at once.
 */
export function createMusicDirector(options: MusicDirectorOptions): MusicDirector {
  const byId = new Map(options.slots.map((s) => [s.id, s]))
  let current: string | null = null
  let away = 0
  return {
    get slot() {
      return current
    },
    step(state, dt) {
      const answer = slotFor(options.rules, state)
      if (answer === 'hold') return current
      const next = answer === undefined || answer === 'silence' ? null : answer
      if (next === current) {
        away = 0
        return current
      }
      const linger = (current === null ? undefined : byId.get(current)?.linger) ?? 0
      const calm = answer === 'silence' || (next !== null && byId.get(next)?.relief === true)
      if (linger > 0 && !calm) {
        away += dt
        if (away < linger) return current
      }
      away = 0
      current = next
      return current
    },
  }
}
