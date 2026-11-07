// The puzzle solver, from the adventure source's solver: a breadth-first search over a puzzle's
// abstract states. A step is a verb as the player makes it, resolved by the interpreter's own rule (puzzle's `uses` and
// `holds`, PZ-D1): the first action, in content order, whose place, `use` and conditions match. What code does is the
// scene's model. Build time and tests only.
import { uses as usesVerb } from '../../shared/sim/interpret'
import type { Action, PuzzleDef } from '../../shared/sim/puzzle.schema'
import type { Cond } from '../../shared/sim/value.schema'
import {
  type HintResult,
  type KeyResult,
  type PuzzleModel,
  type Softlocks,
  type Solution,
  type SolveResult,
  SPECIAL,
  type State,
  type Step,
} from './model'
import { applyEffect, clone, holds } from './state'

const CAP = 200_000
type Entry = PuzzleDef['entry'][number]
interface Node {
  readonly state: State
  readonly entry: string
  readonly from: number
  readonly step: Step | null
  readonly edges: number[]
  readonly depth: number
}
/** A verb the player can make in a state, with the action it resolves to. */
export interface Verb {
  readonly step: Step
  readonly action: Action | null
}
export interface Solver {
  /** The action the game would pick for this verb, or null for its fallback line. */
  match(s: State, at: string, held?: string, pair?: readonly [string, string], code?: string): Action | null
  verbs(s: State, banned: ReadonlySet<string>): Verb[]
  next(s: State, step: Step, action: Action | null): State[]
  isGoal(s: State): boolean
  start(entry: PuzzleDef['entry'][number]): State
  keys(): KeyResult[]
  solve(): SolveResult
  softlocks(limit?: number): Softlocks
  states(sol: Solution): State[]
  hints(solutions: readonly Solution[]): HintResult[]
}

const reads = (c: Cond): string[] =>
  'not' in c ? reads(c.not) : 'any' in c ? c.any.flatMap(reads) : 'fact' in c ? [c.fact] : []
const codesIn = (c: Cond): string[] =>
  'not' in c
    ? codesIn(c.not)
    : 'any' in c
      ? c.any.flatMap(codesIn)
      : 'fact' in c && c.fact === 'code' && typeof c.is === 'string'
        ? [c.is]
        : []
const readsHeld = (c: Cond): boolean =>
  'not' in c ? readsHeld(c.not) : 'any' in c ? c.any.some(readsHeld) : 'fact' in c && c.fact === 'held'

export function createSolver(def: PuzzleDef, model: PuzzleModel = {}): Solver {
  const hotspots = [...new Set(def.actions.map((a) => a.at).filter((at) => !SPECIAL.has(at)))]
  const codes = [...new Set(def.actions.flatMap((a) => (a.when ?? []).flatMap(codesIn))), '']
  // A systemic set-up only matters if some condition reads what it enables; the rest would only multiply states.
  const read = new Set(
    [
      ...def.actions.flatMap((a) => a.when ?? []),
      ...def.goal,
      ...Object.values(model.require ?? {}).flat(),
    ].flatMap(reads),
  )
  const systemic = def.systemic.filter((sys) => sys.enables.some((c) => reads(c).some((f) => read.has(f))))
  const watched = new Set(systemic.flatMap((s) => s.via))
  // Actions by place, in content order (a hot path: every verb in every state looks one up).
  const byAt = new Map<string, Action[]>()
  for (const a of def.actions) byAt.set(a.at, [...(byAt.get(a.at) ?? []), a])
  const secondsOf = (id: string): number =>
    def.actions.find((a) => a.id === id)?.seconds ?? model.seconds ?? 2
  const secondsFor = (steps: readonly Step[]): number =>
    steps.reduce((sum, st) => sum + (st.systemic === true ? 2 : secondsOf(st.action)), 0)

  /** The action the game would pick for this verb, or null for its fallback line. */
  function match(
    s: State,
    at: string,
    held = '',
    pair?: readonly [string, string],
    code = '',
  ): Action | null {
    const verb = { at, held: held === '' ? undefined : held, pair, code: code === '' ? undefined : code }
    return (
      (byAt.get(at) ?? []).find(
        (a) => usesVerb(a, verb) && (a.when ?? []).every((c) => holds(s, c, held, code)),
      ) ?? null
    )
  }
  /** An action that changes nothing (a look, a line) leads back to the same state, so it is not a step. */
  const inertIds = new Set(
    def.actions
      .filter(
        (a) =>
          !a.then.some((e) => 'set' in e || 'add' in e || 'give' in e || 'take' in e || 'call' in e) &&
          (model.effects?.[a.id]?.length ?? 0) === 0 &&
          !watched.has(a.id),
      )
      .map((a) => a.id),
  )
  const inert = (a: Action): boolean => inertIds.has(a.id)
  const pure = new Set(model.pure ?? [])
  const heldFree = new Set(
    def.actions
      .filter(
        (a) =>
          a.use === undefined &&
          ![...(a.when ?? []), ...(model.require?.[a.id] ?? [])].some(readsHeld) &&
          a.then.every((e) => !('call' in e) || pure.has(e.call)),
      )
      .map((a) => a.id),
  )

  /** Every verb the player can make in `s`, with the action it resolves to (fallbacks are not steps). */
  function verbs(s: State, banned: ReadonlySet<string>): Verb[] {
    const out: Verb[] = []
    const distinct = [...new Set(s.items)]
    const push = (step: Omit<Step, 'action'>, action: Action | null) => {
      if (action === null || banned.has(action.id) || inert(action)) return
      if (!(model.require?.[action.id] ?? []).every((c) => holds(s, c, step.held ?? '', step.code ?? '')))
        return
      out.push({ step: { ...step, action: action.id }, action })
    }
    for (const at of hotspots)
      if (model.available?.(s, at) ?? true) {
        let tried: Action | null = null
        for (const held of ['', ...distinct]) {
          const action = match(s, at, held)
          // An action that ends the same whatever is held is tried once (with the first item, a bare hand).
          if (action !== null && action === tried) continue
          if (action !== null && heldFree.has(action.id)) tried = action
          push(held === '' ? { at } : { at, held }, action)
        }
      }
    for (const held of distinct) push({ at: 'floor', held }, match(s, 'floor', held))
    for (let i = 0; i < distinct.length; i++)
      for (let j = i; j < distinct.length; j++) {
        const a = distinct[i] as string
        const b = distinct[j] as string
        if (i === j && s.items.filter((x) => x === a).length < 2) continue
        const pair: [string, string] = [a, b]
        push({ at: 'combine', pair }, match(s, 'combine', '', pair))
      }
    for (const code of codes) push({ at: 'code', code }, match(s, 'code', '', undefined, code))
    // Systemic set-ups: once any of an entry's `via` actions has happened, its `enables` may be assumed.
    for (const sys of systemic)
      if (
        !banned.has(`systemic:${sys.id}`) &&
        sys.via.some((v) => s.seen.includes(v)) &&
        !sys.enables.every((c) => holds(s, c))
      )
        out.push({ step: { action: `systemic:${sys.id}`, at: 'code', systemic: true }, action: null })
    return out
  }

  /** The states one step leads to (several when a modelled call branches). */
  function next(s: State, step: Step, action: Action | null): State[] {
    if (step.systemic === true) {
      const sys = def.systemic.find((x) => `systemic:${x.id}` === step.action)
      if (sys === undefined) throw new Error(`${def.scene}: no systemic ${step.action}`)
      const t = clone(s)
      const own = model.systemic?.[sys.id]
      if (own !== undefined) return own(t)
      for (const c of sys.enables) if ('fact' in c && c.is !== undefined) t.facts[c.fact] = c.is
      return [t]
    }
    if (action === null) throw new Error(`${def.scene}: a step with no action`)
    let states = [clone(s)]
    for (const e of action.then) {
      if ('call' in e) {
        const call = model.calls?.[e.call]
        if (call === undefined)
          throw new Error(`The solver has no model for call ${e.call} (action ${action.id})`)
        states = states.flatMap((x) => call(x, step))
      } else for (const x of states) applyEffect(x, e)
    }
    for (const x of states) {
      for (const e of model.effects?.[action.id] ?? []) applyEffect(x, e)
      if (watched.has(action.id) && !x.seen.includes(action.id)) x.seen.push(action.id)
    }
    const after = model.after
    return after === undefined ? states : states.map((x) => after(x, step))
  }

  // The visited key: fact values in a fixed order, then the sorted items and set-ups (a hot path, so no JSON).
  const names = [
    ...new Set([
      ...Object.keys(def.facts),
      ...Object.keys(model.facts ?? {}),
      ...def.entry.flatMap((e) => Object.keys(e.facts ?? {})),
    ]),
  ]
  const named = new Set(names)
  const keyOf = (s: State): string => {
    let k = ''
    for (const n of names) k += `${String(s.facts[n])}\u0001`
    for (const n of Object.keys(s.facts).sort()) if (!named.has(n)) k += `${n}=${String(s.facts[n])}\u0001`
    return `${k}\u0002${[...s.items].sort().join(',')}\u0002${[...s.seen].sort().join(',')}`
  }
  const isGoal = (s: State): boolean => def.goal.every((c) => holds(s, c))
  const start = (entry: Entry): State => ({
    facts: { ...def.facts, ...model.facts, ...entry.facts },
    items: [...entry.items],
    seen: [],
  })

  /** Breadth-first search from `seeds`; stops at the first goal state unless `whole`. */
  function bfs(seeds: readonly Entry[], banned: ReadonlySet<string>, whole: boolean) {
    const nodes: Node[] = []
    const ids = new Map<string, number>()
    let capped = false
    let found = -1
    const fired = new Set<string>()
    const add = (state: State, entry: string, from: number, step: Step | null): number => {
      const k = keyOf(state)
      const known = ids.get(k)
      if (known !== undefined) return known
      ids.set(k, nodes.length)
      nodes.push({
        state,
        entry,
        from,
        step,
        edges: [],
        depth: from < 0 ? 0 : (nodes[from] as Node).depth + 1,
      })
      if (found < 0 && isGoal(state)) found = nodes.length - 1
      return nodes.length - 1
    }
    for (const entry of seeds) add(start(entry), entry.name, -1, null)
    for (let head = 0; head < nodes.length && (whole || found < 0); head++) {
      if (head >= (model.cap ?? CAP)) {
        capped = true
        break
      }
      const n = nodes[head] as Node
      for (const { step, action } of verbs(n.state, banned)) {
        fired.add(step.action)
        for (const t of next(n.state, step, action)) n.edges.push(add(t, n.entry, head, step))
      }
    }
    return { nodes, capped, found, fired }
  }
  const path = (nodes: readonly Node[], i: number): Step[] => {
    const steps: Step[] = []
    for (let at = i; (nodes[at] as Node).step !== null; at = (nodes[at] as Node).from)
      steps.unshift((nodes[at] as Node).step as Step)
    return steps
  }

  /**
   * Every state reachable from every entry with nothing banned, expanded once: its edges in the order `verbs` and
   * `next` give them, each as [to, action, verb index]. Banning only removes edges, so a search with bans walks this
   * graph instead of expanding states again (the costly part), visits states in the same order and finds the same
   * solution. Null when the whole graph is over the cap: searches then expand states as before.
   */
  let graph:
    | { nodes: State[]; edges: Int32Array[]; actions: string[]; goal: Uint8Array; seeds: number[] }
    | null
    | undefined
  function wholeGraph() {
    if (graph !== undefined) return graph
    const nodes: State[] = []
    const ids = new Map<string, number>()
    const edges: Int32Array[] = []
    const actions: string[] = []
    const actionIds = new Map<string, number>()
    const add = (state: State): number => {
      const k = keyOf(state)
      const known = ids.get(k)
      if (known !== undefined) return known
      ids.set(k, nodes.length)
      nodes.push(state)
      return nodes.length - 1
    }
    const seeds = def.entry.map((entry) => add(start(entry)))
    for (let head = 0; head < nodes.length; head++) {
      if (head >= (model.cap ?? CAP)) {
        graph = null
        return graph
      }
      const out: number[] = []
      const state = nodes[head] as State
      verbs(state, new Set()).forEach(({ step, action }, v) => {
        let a = actionIds.get(step.action)
        if (a === undefined) {
          a = actions.length
          actions.push(step.action)
          actionIds.set(step.action, a)
        }
        for (const t of next(state, step, action)) out.push(add(t), a, v)
      })
      edges.push(Int32Array.from(out))
    }
    graph = { nodes, edges, actions, goal: Uint8Array.from(nodes, (n) => (isGoal(n) ? 1 : 0)), seeds }
    return graph
  }
  /** `bfs` without `whole`, over the whole graph: the same nodes in the same order, without expanding a state. */
  function walk(seeds: readonly Entry[], banned: ReadonlySet<string>) {
    const g = wholeGraph()
    if (g === null) return null
    const ban = Uint8Array.from(g.actions, (a) => (banned.has(a) ? 1 : 0))
    const seen = new Int32Array(g.nodes.length).fill(-1)
    const order: number[] = []
    const from: number[] = []
    const via: number[] = []
    const entry: string[] = []
    let found = -1
    let capped = false
    const visit = (id: number, e: string, f: number, v: number) => {
      if ((seen[id] as number) >= 0) return
      seen[id] = order.length
      order.push(id)
      from.push(f)
      via.push(v)
      entry.push(e)
      if (found < 0 && g.goal[id] === 1) found = order.length - 1
    }
    for (const e of seeds) visit(g.seeds[def.entry.indexOf(e)] as number, e.name, -1, -1)
    for (let head = 0; head < order.length && found < 0; head++) {
      if (head >= (model.cap ?? CAP)) {
        capped = true
        break
      }
      const out = g.edges[order[head] as number] as Int32Array
      for (let i = 0; i < out.length; i += 3)
        if (ban[out[i + 1] as number] === 0)
          visit(out[i] as number, entry[head] as string, head, out[i + 2] as number)
    }
    // The steps back from the goal: each is the verb it was, found again in the state it was made in.
    const steps: Step[] = []
    for (let i = found; i >= 0 && (from[i] as number) >= 0; i = from[i] as number) {
      const made = verbs(g.nodes[order[from[i] as number] as number] as State, new Set())[
        via[i] as number
      ] as Verb
      steps.unshift(made.step)
    }
    return {
      states: order.length,
      capped,
      found: found < 0 ? null : { entry: entry[found] as string, steps },
    }
  }

  /** The shortest solution over every entry: one search, so the first goal found is the shortest, ties to the earlier entry. */
  function shortest(banned: ReadonlySet<string> = new Set(), only?: string) {
    const seeds = def.entry.filter((e) => only === undefined || e.name === only)
    const w = walk(seeds, banned)
    if (w !== null) {
      const best: Solution | null =
        w.found === null
          ? null
          : { entry: w.found.entry, steps: w.found.steps, seconds: secondsFor(w.found.steps) }
      return { best, states: w.states, capped: w.capped }
    }
    const r = bfs(seeds, banned, false)
    const steps = r.found < 0 ? null : path(r.nodes, r.found)
    const best: Solution | null =
      steps === null ? null : { entry: (r.nodes[r.found] as Node).entry, steps, seconds: secondsFor(steps) }
    return { best, states: r.nodes.length, capped: r.capped }
  }
  const actionOf = (id: string): Action | null => def.actions.find((a) => a.id === id) ?? null
  const entryNamed = (name: string): Entry => {
    const entry = def.entry.find((e) => e.name === name)
    if (entry === undefined) throw new Error(`${def.scene}: no entry ${name}`)
    return entry
  }

  return {
    match,
    verbs,
    next,
    isGoal,
    start,
    /** Each declared key-set: its shortest solution with its bans, and whether it takes every step it names. */
    keys(): KeyResult[] {
      return (model.keys ?? []).map((k) => {
        const solution = shortest(new Set(k.ban ?? []), k.entry).best
        const taken = new Set(solution?.steps.map((x) => x.action) ?? [])
        const missing = k.uses.filter((u) => !taken.has(u))
        return { ...k, solution, ok: solution !== null && missing.length === 0, missing }
      })
    },
    /**
     * The shortest solution, and the other keys to each of its locks: ban one of its actions, find the replacement
     * (the last action the new solution adds), ban that too, and so on until none is left.
     */
    solve(): SolveResult {
      const { best, states, capped } = shortest()
      const alternatives: { banned: string; solution: Solution | null }[] = []
      if (best !== null)
        for (const id of [...new Set(best.steps.map((s) => s.action))]) {
          const banned = new Set([id])
          for (let guard = 0; guard < 12; guard++) {
            const solution = shortest(banned).best
            alternatives.push({ banned: [...banned].join(' + '), solution })
            const fresh =
              solution?.steps
                .map((s) => s.action)
                .filter((a) => !best.steps.some((b) => b.action === a) && !banned.has(a)) ?? []
            if (solution === null || fresh.length === 0) break
            // The replacement key is the last new action (the ones before it only reach it: an item, a curtain).
            banned.add(fresh[fresh.length - 1] as string)
          }
        }
      const sets = [best, ...alternatives.map((a) => a.solution)]
        .filter((x): x is Solution => x !== null)
        .map((x) => [...new Set(x.steps.map((s) => s.action))].sort())
      const keySets = [...new Map(sets.map((k) => [k.join(' '), k])).values()]
      return { solvable: best !== null, states, capped, shortest: best, alternatives, keySets }
    },
    /** Every reachable state from which the goal can no longer be reached, with the trail that leads there. */
    softlocks(limit = 20): Softlocks {
      const { nodes, capped, fired } = bfs(def.entry, new Set(), true)
      // Walk the edges backwards from every goal state.
      const into: number[][] = nodes.map(() => [])
      nodes.forEach((n, i) => {
        for (const e of n.edges) (into[e] as number[]).push(i)
      })
      const reaches = new Uint8Array(nodes.length)
      const queue: number[] = []
      nodes.forEach((n, i) => {
        if (isGoal(n.state)) {
          reaches[i] = 1
          queue.push(i)
        }
      })
      while (queue.length > 0)
        for (const i of into[queue.pop() as number] as number[])
          if (reaches[i] === 0) {
            reaches[i] = 1
            queue.push(i)
          }
      const stuck = nodes.map((n, i) => ({ n, i })).filter(({ i }) => reaches[i] === 0)
      // An expanded state has edges; with a cap, unexpanded states are not counted as stuck.
      const real = capped ? stuck.filter(({ n }) => n.edges.length > 0) : stuck
      const trail = (i: number) =>
        path(nodes, i).map((st) => (st.held === undefined ? st.action : `${st.action} (${st.held})`))
      const never = def.actions.filter((a) => !inert(a) && !fired.has(a.id)).map((a) => a.id)
      return {
        states: nodes.length,
        capped,
        count: real.length,
        softlocks: real.slice(0, limit).map(({ n, i }) => ({
          entry: n.entry,
          trail: trail(i),
          facts: n.state.facts,
          items: n.state.items,
        })),
        never,
      }
    },
    /** The states a solution passes through: before each step, then after the last. */
    states(sol: Solution): State[] {
      let s = start(entryNamed(sol.entry))
      const out = [s]
      for (const step of sol.steps) {
        s = next(s, step, actionOf(step.action))[0] as State
        out.push(s)
      }
      return out
    },
    /**
     * For each lethal entry, along every solution, one of its `hintedBy` actions must be available at or before the
     * first step that exposes the risk (an action that sets up a systemic entry with a risk).
     */
    hints(solutions: readonly Solution[]): HintResult[] {
      const exposing = new Set(def.systemic.filter((s) => s.risk !== undefined).flatMap((s) => s.via))
      return def.lethal.map((l) => {
        const failures: string[] = []
        for (const sol of solutions) {
          let s = start(entryNamed(sol.entry))
          let hinted = false
          let exposedAt = -1
          for (let i = 0; i <= sol.steps.length; i++) {
            if (verbs(s, new Set()).some((v) => l.hintedBy.includes(v.step.action))) hinted = true
            const step = sol.steps[i]
            if (step === undefined) break
            if (exposing.has(step.action)) {
              exposedAt = i
              if (!hinted) break
            }
            s = next(s, step, actionOf(step.action))[0] as State
          }
          if (exposedAt >= 0 && !hinted)
            failures.push(
              `${sol.entry}: step ${exposedAt + 1} (${(sol.steps[exposedAt] as Step).action}) exposes the risk before any of ${l.hintedBy.join(', ')} is available`,
            )
        }
        return { id: l.id, ok: failures.length === 0, failures }
      })
    },
  }
}
