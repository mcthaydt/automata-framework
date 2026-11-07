// The item × hotspot matrix and the route budget, from the adventure source's solver.
import type { PuzzleDef } from '../../shared/sim/puzzle.schema'
import { type Solution, SPECIAL } from './model'

export interface Matrix {
  readonly hotspots: readonly string[]
  /** Per item, per hotspot: its own actions, `any` (a response whatever is held) or `fallback`. */
  readonly rows: readonly { item: string; cells: Record<string, string> }[]
  readonly combines: readonly { pair: readonly [string, string]; action: string }[]
}
export function matrix(def: PuzzleDef): Matrix {
  const hotspots = [...new Set(def.actions.map((a) => a.at).filter((at) => !SPECIAL.has(at)))]
  const rows = def.items.map((item) => ({
    item,
    cells: Object.fromEntries(
      hotspots.map((at) => {
        const own = def.actions.filter((a) => a.at === at && a.use === item).map((a) => a.id)
        const any = def.actions.some(
          (a) =>
            a.at === at &&
            a.use === undefined &&
            !(a.when ?? []).some((c) => 'fact' in c && c.fact === 'held'),
        )
        return [at, own.length > 0 ? own.join(', ') : any ? 'any' : 'fallback']
      }),
    ),
  }))
  const combines = def.actions
    .filter((a) => a.at === 'combine' && Array.isArray(a.use))
    .map((a) => ({ pair: a.use as readonly [string, string], action: a.id }))
  return { hotspots, rows, combines }
}

/** Metres walked between two hotspots (null: from the spawn). */
export type Walk = (from: string | null, to: string) => number

export interface Budget {
  readonly actions: number
  readonly walking: number
  readonly total: number
}
/** Seconds for a solution: action time plus walking between hotspots at `speed` m/s; a code is typed at `keypad`. */
export function budget(solution: Solution, walk: Walk, speed = 3, keypad?: string): Budget {
  let at: string | null = null
  let walking = 0
  for (const step of solution.steps) {
    const target =
      step.systemic === true || step.at === 'combine' || step.at === 'floor'
        ? null
        : step.at === 'code'
          ? (keypad ?? null)
          : step.at
    if (target !== null) {
      walking += walk(at, target) / speed
      at = target
    }
  }
  return { actions: solution.seconds, walking, total: solution.seconds + walking }
}
