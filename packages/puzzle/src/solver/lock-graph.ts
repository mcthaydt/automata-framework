// The lock graph (M6 spec §4.5), from the adventure source's puzzle pipeline: which step of each route needs which
// earlier one, found by leaving each step out and replaying the rest. A later step that no longer resolves, or changes
// something else, depends on it. Transitive edges are dropped, so the graph reads "A is needed for B".
import type { Route } from './analyse'
import type { State, Step } from './model'
import type { PuzzleScene } from './scene'
import { createSolver } from './solver'
import { condFacts, condItems, used } from './validate'

export interface LockEdge {
  readonly from: string
  readonly to: string
  readonly label: string
}
export const GOAL = 'goal'

/** The change a step makes: facts that moved, items gained (+) and spent (−). */
function change(a: State, b: State): string[] {
  const out: string[] = []
  for (const k of [...new Set([...Object.keys(a.facts), ...Object.keys(b.facts)])].sort())
    if (a.facts[k] !== b.facts[k]) out.push(k)
  const count = (list: readonly string[]) => {
    const m: Record<string, number> = {}
    for (const x of list) m[x] = (m[x] ?? 0) + 1
    return m
  }
  const before = count(a.items)
  const after = count(b.items)
  for (const k of [...new Set([...a.items, ...b.items])].sort()) {
    const d = (after[k] ?? 0) - (before[k] ?? 0)
    if (d > 0) out.push(`+${k}`)
    else if (d < 0) out.push(`−${k}`)
  }
  return out
}
const sameStep = (a: Step, b: Step): boolean =>
  a.action === b.action &&
  a.at === b.at &&
  (a.held ?? '') === (b.held ?? '') &&
  (a.code ?? '') === (b.code ?? '') &&
  JSON.stringify(a.pair ?? null) === JSON.stringify(b.pair ?? null)

export function lockGraph(p: PuzzleScene, routes: readonly Route[]): { nodes: string[]; edges: LockEdge[] } {
  const solver = createSolver(p.def, p.model)
  const edges: LockEdge[] = []
  const nodes: string[] = []
  const reads = (id: string, held?: string) => {
    const a = p.def.actions.find((x) => x.id === id)
    if (a === undefined) return new Set<string>()
    const earlier = p.def.actions.slice(0, p.def.actions.indexOf(a)).filter((b) => b.at === a.at)
    const conds = [
      ...(a.when ?? []),
      ...earlier.flatMap((b) => b.when ?? []),
      ...(p.model.require?.[id] ?? []),
    ]
    return new Set([
      ...conds.flatMap(condFacts),
      ...conds.flatMap(condItems).map((i) => `+${i}`),
      ...used(a).map((i) => `+${i}`),
      ...(held === undefined ? [] : [`+${held}`]),
    ])
  }
  for (const route of routes) {
    const steps = route.solution.steps
    const entry = p.def.entry.find((e) => e.name === route.solution.entry)
    if (entry === undefined) continue
    const play = (skip: number) => {
      let s = solver.start(entry)
      const diffs: (string[] | null)[] = []
      steps.forEach((step, i) => {
        if (i === skip) {
          diffs.push(null)
          return
        }
        const verb = solver.verbs(s, new Set()).find((v) => sameStep(v.step, step))
        if (verb === undefined) {
          diffs.push(null)
          return
        }
        const t = solver.next(s, verb.step, verb.action)[0] as State
        diffs.push(change(s, t))
        s = t
      })
      return { diffs, goal: solver.isGoal(s) }
    }
    const base = play(-1)
    const needs = new Map<number, Set<number>>()
    for (let i = 0; i <= steps.length; i++) needs.set(i, new Set())
    for (let a = 0; a < steps.length; a++) {
      const skipped = play(a)
      for (let b = a + 1; b < steps.length; b++)
        if (JSON.stringify(skipped.diffs[b]) !== JSON.stringify(base.diffs[b])) needs.get(b)?.add(a)
      if (!skipped.goal) needs.get(steps.length)?.add(a)
    }
    // Transitive reduction: drop a → b when a → c → b for some c between them.
    const closure = (b: number): Set<number> => {
      const all = new Set<number>()
      for (const c of needs.get(b) ?? []) {
        all.add(c)
        for (const d of closure(c)) all.add(d)
      }
      return all
    }
    for (const set of needs.values())
      for (const a of [...set]) if ([...set].some((c) => c !== a && closure(c).has(a))) set.delete(a)
    const name = (i: number) => (i === steps.length ? GOAL : (steps[i] as Step).action)
    for (let b = 0; b <= steps.length; b++)
      for (const a of [...(needs.get(b) ?? [])].sort((x, y) => x - y)) {
        const gives = base.diffs[a] ?? []
        const wants =
          b === steps.length
            ? new Set(p.def.goal.flatMap(condFacts))
            : reads((steps[b] as Step).action, (steps[b] as Step).held)
        const shared = gives.filter((g) => wants.has(g))
        // With nothing B reads by name (an opened door, a drained box), what A changes; items spent are no key.
        const label = (shared.length > 0 ? shared : gives.filter((g) => !g.startsWith('−'))).join(', ')
        if (!edges.some((e) => e.from === name(a) && e.to === name(b)))
          edges.push({ from: name(a), to: name(b), label })
      }
    for (const s of steps) if (!nodes.includes(s.action)) nodes.push(s.action)
  }
  return { nodes, edges }
}
