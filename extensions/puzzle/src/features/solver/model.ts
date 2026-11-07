// The solver's types, from the adventure source's solver: the abstract state, a step as the player makes
// it, and the per-scene model that says what code (`{ call }`) does, which data cannot say.
import type { Effect } from '../../shared/sim/puzzle.schema'
import type { Cond, Value } from '../../shared/sim/value.schema'

/** The puzzle's facts, the player's items (a multiset) and which systemic set-ups have happened. */
export interface State {
  facts: Record<string, Value>
  items: string[]
  seen: string[]
}
/** A verb as the player makes it: a hotspot with a held item (or a bare hand), a floor use, a combine, a typed code. */
export interface Step {
  readonly action: string
  readonly at: string
  readonly held?: string | undefined
  readonly pair?: readonly [string, string] | undefined
  readonly code?: string | undefined
  /** A systemic set-up (`systemic:<id>`), not a verb. */
  readonly systemic?: boolean | undefined
}
/**
 * A key-set the design asks for: the shortest solution with the actions in `ban` banned must take
 * every action in `uses` to open `lock` with `key`, optionally from one entry.
 */
export interface KeyDecl {
  readonly lock: string
  readonly key: string
  readonly uses: readonly string[]
  readonly ban?: readonly string[] | undefined
  readonly entry?: string | undefined
}
/**
 * What data cannot say about a scene, for the solver: what each `call` effect does, extra facts,
 * solver-only effects and conditions, what time does after a step, which hotspots exist in which
 * state, the key-sets the design asks for and how many states a search expands before it stops.
 */
export interface PuzzleModel {
  /** Extra facts the solver tracks, with their starting values. */
  readonly facts?: Readonly<Record<string, Value>> | undefined
  /** What each `{ call }` does: the possible resulting states. */
  readonly calls?: Readonly<Record<string, (s: State, step: Step) => State[]>> | undefined
  /** Solver-only effects after an action's own. */
  readonly effects?: Readonly<Record<string, readonly Effect[]>> | undefined
  /** Solver-only conditions: the player can take this action only if these hold. */
  readonly require?: Readonly<Record<string, readonly Cond[]>> | undefined
  /** What time does after any step; applied after the step's effects. */
  readonly after?: ((s: State, step: Step) => State) | undefined
  /** Whether a hotspot exists in this state (default: always). */
  readonly available?: ((s: State, at: string) => boolean) | undefined
  /** What a systemic set-up does when that depends on the state (default: it sets its `enables`). */
  readonly systemic?: Readonly<Record<string, (s: State) => State[]>> | undefined
  /** Seconds an action takes when it gives none (default 2). */
  readonly seconds?: number | undefined
  /** Calls whose result does not depend on the item in hand: such an action is tried once, bare-handed. */
  readonly pure?: readonly string[] | undefined
  /** States a search expands before it stops as capped (default 200,000). */
  readonly cap?: number | undefined
  /** The key-sets the design asks for: the shortest solution with `ban` banned must take every step in `uses`. */
  readonly keys?: readonly KeyDecl[] | undefined
}
/**
 * A route through the puzzle: the entry it starts from, the steps in order and the seconds they
 * take.
 */
export interface Solution {
  readonly entry: string
  readonly steps: readonly Step[]
  readonly seconds: number
}
/**
 * A key-set check: the declaration, the shortest solution found with its actions banned, whether
 * it used every action asked for, and which it missed.
 */
export interface KeyResult extends KeyDecl {
  readonly solution: Solution | null
  readonly ok: boolean
  readonly missing: readonly string[]
}
/**
 * What solving found: whether the puzzle can be solved, how many states were searched, whether the
 * search was capped, the shortest solution, one alternative for each action of it banned in turn,
 * and the distinct sets of actions used.
 */
export interface SolveResult {
  readonly solvable: boolean
  readonly states: number
  readonly capped: boolean
  readonly shortest: Solution | null
  /** One solution per alternative: banning each action of the shortest solution in turn. */
  readonly alternatives: readonly { readonly banned: string; readonly solution: Solution | null }[]
  /** Distinct sets of action ids across the shortest solution and the alternatives. */
  readonly keySets: readonly (readonly string[])[]
}
/**
 * The states from which the goal can no longer be reached, with the trail to each, and the actions
 * that change something but are never taken in any reachable state.
 */
export interface Softlocks {
  readonly states: number
  readonly capped: boolean
  readonly count: number
  readonly softlocks: readonly {
    entry: string
    trail: string[]
    facts: Record<string, Value>
    items: string[]
  }[]
  /** Actions that change something but are never taken in any reachable state. */
  readonly never: readonly string[]
}
/** Whether the hints on one lethal rule hold: its id, whether they do and what failed. */
export interface HintResult {
  readonly id: string
  readonly ok: boolean
  readonly failures: readonly string[]
}
/** The verbs a code, combine or floor use are made at, besides hotspots. */
export const SPECIAL: ReadonlySet<string> = new Set(['combine', 'floor', 'code'])
