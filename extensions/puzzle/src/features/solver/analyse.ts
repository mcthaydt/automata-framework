// `analyse` and the routes, from the adventure source's puzzle pipeline: the solve, the routes (the
// shortest and one per distinct key-set), the softlocks, the hints and the declared key-sets, for the doc and `check`.
import { type Budget, budget } from './matrix'
import {
  type HintResult,
  type KeyResult,
  type Softlocks,
  type Solution,
  type SolveResult,
  SPECIAL,
} from './model'
import type { PuzzleScene } from './scene'
import { createSolver } from './solver'

export interface Route {
  readonly name: string
  readonly banned: string | null
  readonly solution: Solution
}
export interface Analysis {
  readonly solve: SolveResult
  readonly routes: readonly Route[]
  readonly softlocks: Softlocks
  readonly hints: readonly HintResult[]
  /** The key-sets the design asks for (the model's `keys`), each with its route. */
  readonly keys: readonly KeyResult[]
}
export const keySet = (s: Solution): string => [...new Set(s.steps.map((x) => x.action))].sort().join(' ')

/** The shortest solution, then one per distinct key-set among the alternatives, in the solver's order. */
export function routesOf(result: SolveResult): Route[] {
  const routes: Route[] = []
  const seen = new Set<string>()
  const add = (name: string, banned: string | null, solution: Solution | null) => {
    if (solution === null || seen.has(keySet(solution))) return
    seen.add(keySet(solution))
    routes.push({ name, banned, solution })
  }
  add('shortest', null, result.shortest)
  for (const a of result.alternatives)
    add(`without ${a.banned.split(' + ').join(', ')}`, a.banned, a.solution)
  return routes
}

export function analyse(p: PuzzleScene, opts: { entry?: string; softlocks?: boolean } = {}): Analysis {
  const def =
    opts.entry === undefined ? p.def : { ...p.def, entry: p.def.entry.filter((e) => e.name === opts.entry) }
  if (def.entry.length === 0)
    throw new Error(
      `no entry ${opts.entry} in ${p.id}'s puzzle (entries: ${p.def.entry.map((e) => e.name).join(', ')})`,
    )
  const solver = createSolver(def, p.model)
  const solve = solver.solve()
  const routes = routesOf(solve)
  // Declared key-sets get their own routes (named for the lock and key), unless an alternative already has that key-set.
  const keys = opts.entry === undefined ? solver.keys() : []
  const sets = new Set(routes.map((r) => keySet(r.solution)))
  for (const k of keys)
    if (k.solution !== null && !sets.has(keySet(k.solution))) {
      sets.add(keySet(k.solution))
      routes.push({
        name: `${k.lock}: ${k.key}`,
        banned: (k.ban ?? []).join(' + ') || null,
        solution: k.solution,
      })
    }
  const softlocks: Softlocks =
    opts.softlocks === false
      ? { states: 0, capped: false, count: 0, softlocks: [], never: [] }
      : solver.softlocks()
  return { solve, routes, softlocks, hints: solver.hints(routes.map((r) => r.solution)), keys }
}

/** The hotspot a code is typed at: the one whose action opens the keypad. */
export const keypadOf = (p: PuzzleScene): string | undefined =>
  p.def.actions.find((a) => !SPECIAL.has(a.at) && a.then.some((e) => 'keypad' in e))?.at
export const timing = (p: PuzzleScene, solution: Solution): Budget => budget(solution, p.walk, 3, keypadOf(p))
