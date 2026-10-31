// What a run, a scenario and a playtest measure (the adventure source's `RunResult`, `ScenarioResult` and `Playtest`).
// Seconds are steps over the sim's rate, so every measure is exact and the same in every run.
import type { Policy } from './bot'

export interface Death {
  readonly cause: string
  readonly t: number
  /** Seconds the catching agent had been a threat before the catch, or null when none was. */
  readonly telegraph: number | null
}
/** An agent that came through a door or out of an ambush: when, in which mode, and how far from the player. */
export interface Appearance {
  readonly t: number
  readonly agent: string
  readonly mode: string
  readonly gap: number
}
export interface RunResult {
  readonly outcome: 'win' | 'lose' | 'timeout' | 'condition'
  readonly time: number
  readonly deaths: readonly Death[]
  /** Seconds to the first step an agent was a threat, or null. */
  readonly firstThreat: number | null
  /** Seconds each catching agent had been a threat before the catch. */
  readonly telegraphs: readonly number[]
  /** Seconds per agent mode, summed over agents. */
  readonly modes: Readonly<Record<string, number>>
  /** Seconds between threats (and before the first, and after the last). */
  readonly safeWindows: readonly number[]
  /** Verbs (bot tokens) that changed the puzzle's state, in order. */
  readonly skeleton: readonly string[]
  /** When a scenario's condition first held, or null. */
  readonly conditionAt: number | null
  readonly appearances: readonly Appearance[]
  /** Seconds from an ambush's appearance to a catch by that agent. */
  readonly ambushCatches: readonly number[]
  /** Per hide, seconds an agent stayed a threat after the player hid. */
  readonly hides: readonly number[]
  /** The scene's safe window: when it last opened before the win, and when the win came. */
  readonly window?: { readonly opened: number; readonly won: number } | null | undefined
}
export interface PlaytestRun extends RunResult {
  readonly route: string
  readonly entry: string
  readonly policy: Policy
  readonly seed: number
}
export interface ScenarioResult {
  readonly id: string
  readonly claims?: string | undefined
  readonly policy: Policy
  readonly seeds: number
  readonly successes: number
  readonly probability: number
  readonly expected: number
  readonly within: number
  readonly ok: boolean
  /** When the condition held, per seed (null where it never did). */
  readonly times: readonly (number | null)[]
  readonly deaths: number
  /** What its runs measured of the pursuit, for fairness. */
  readonly pursuit?: Pick<RunResult, 'appearances' | 'ambushCatches' | 'hides'> | undefined
}
