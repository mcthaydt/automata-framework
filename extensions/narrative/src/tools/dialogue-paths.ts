// Dialogue paths (M6.8b step 3; from the source's `dialogue-lint.ts`): every way through a conversation, the stance
// the player can arrive at act after act, whether each ending is on offer at the register, and the motifs an act
// carries. Pure: the caller hands over the acts, with each puzzle route as the actions it takes.
import type { Action, PuzzleDef } from '@mcthaydt/automata-puzzle/sim'
import { applyEffect, type State } from '@mcthaydt/automata-puzzle/solver'
import {
  applyChoice,
  type Canon,
  type Choice,
  type DialogueGraph,
  type DialogueState,
  freshDialogue,
  type LineRecord,
  offered,
  passes,
  readerOf,
} from '../sim/index'
import { collect, type Finding } from './finding'

interface Bounds {
  readonly min: number
  readonly max: number
}
/** The scene a path runs in: its facts and items, read as a puzzle state. */
export type Base = State
const fresh = (): Base => ({ facts: {}, items: [], seen: [] })
const copy = (b: Base): Base => ({ facts: { ...b.facts }, items: [...b.items], seen: [...b.seen] })
const reader = (b: Base) => ({
  fact: (name: string) => b.facts[name],
  has: (item: string) => b.items.includes(item),
})

/**
 * Every way through a graph from `state`: the dialogue states at its exit, deduplicated, with every choice offered on
 * the way. A node that has choices, offers none and has no `next` ends the walk there (`stuck`).
 */
export function walk(
  graph: DialogueGraph,
  state: DialogueState,
  base: Base = fresh(),
  bounds: Bounds = { min: -4, max: 4 },
): { ends: DialogueState[]; offered: { node: string; choice: Choice }[]; stuck: string[] } {
  const ends = new Map<string, DialogueState>()
  const offers = new Map<string, { node: string; choice: Choice }>()
  const stuck = new Set<string>()
  const seen = new Set<string>()
  const visit = (id: string | undefined, s: DialogueState, depth: number): void => {
    const key = `${id}|${JSON.stringify(s)}`
    if (seen.has(key) || depth > 500) return
    seen.add(key)
    if (id === undefined) {
      ends.set(JSON.stringify(s), s)
      return
    }
    const node = graph.nodes[id]
    if (node === undefined) return
    const r = readerOf(s, reader(base))
    if (!passes(node, r)) {
      visit(node.next, s, depth + 1)
      return
    }
    const choices = offered(graph, node, r)
    if (choices.length === 0) {
      if ((node.choices ?? []).length > 0 && node.next === undefined) stuck.add(id)
      else visit(node.next, s, depth + 1)
      return
    }
    for (const { choice } of choices) {
      offers.set(`${id}|${choice.line}`, { node: id, choice })
      visit(choice.next, applyChoice(s, choice, bounds), depth + 1)
    }
  }
  visit(graph.start, state, 0)
  return { ends: [...ends.values()], offered: [...offers.values()], stuck: [...stuck] }
}

/** One act for the stance analysis: its graphs, and each puzzle route as the actions it takes, in order. */
export interface Act {
  readonly scene: string
  readonly graphs: readonly DialogueGraph[]
  readonly def?: Pick<PuzzleDef, 'facts' | 'actions' | 'entry'> | undefined
  /**
   * Per route, the graphs that start outside any action (one that follows a cutscene), played after `after` of the
   * route's actions (0: at the act's start).
   */
  readonly routes: readonly {
    readonly name: string
    readonly entry?: string | undefined
    readonly actions: readonly string[]
    readonly follow?: readonly { readonly after: number; readonly graph: string }[] | undefined
  }[]
}
export interface StanceOptions {
  /** The canon's stance axis. */
  readonly bounds: Bounds
  /** The endings the register must offer, the game's own. Unset: the register is found and reported, not checked. */
  readonly endings?: readonly string[] | undefined
}
export interface StanceResult {
  readonly ok: boolean
  /** Stance range at the end of each act, over every route and path. */
  readonly acts: readonly {
    scene: string
    routes: number
    graphs: string[]
    min: number
    max: number
    states: number
  }[]
  /** The final register: the graph whose choices set `ending`, and the stance range on arriving there. Null until an act has it. */
  readonly register: { graph: string; min: number; max: number } | null
  /** Each ending and whether some route and path offers it at the register. */
  readonly endings: readonly { ending: string; reachable: boolean }[]
  readonly findings: readonly Finding[]
}
/** The ending a register choice chooses (its `set.ending`), or null. */
export const endingOf = (c: Choice): string | null =>
  typeof c.set?.ending === 'string' ? c.set.ending : null

/**
 * Stance over every dialogue path × puzzle route, act after act: each act starts from every dialogue state the act
 * before could end in. The register finale is the graph whose choices set `ending`; with `endings` given, every one
 * must be offered there on some route and path.
 */
export function stance(acts: readonly Act[], options: StanceOptions): StanceResult {
  const { findings, add } = collect()
  const bounds = options.bounds
  let states: DialogueState[] = [freshDialogue()]
  const acted: StanceResult['acts'][number][] = []
  const offeredEndings = new Set<string>()
  const arrivals: number[] = []
  let register: string | null = null
  for (const act of acts) {
    const graphs = new Map(act.graphs.map((g) => [g.id, g]))
    const finale = act.graphs.find((g) =>
      Object.values(g.nodes).some((n) => (n.choices ?? []).some((c) => endingOf(c) !== null)),
    )
    if (finale !== undefined) {
      if (register !== null)
        add('error', 'register', finale.id, `a second register finale (the first is ${register})`)
      register ??= finale.id
    }
    const actions = new Map((act.def?.actions ?? []).map((a) => [a.id, a as Action]))
    const routes = act.routes.length > 0 ? act.routes : [{ name: 'no puzzle', actions: [] as string[] }]
    const next = new Map<string, DialogueState>()
    const started = new Set<string>()
    for (const route of routes) {
      const entries = act.def?.entry ?? []
      const entry = entries.find((e) => e.name === ('entry' in route ? route.entry : undefined)) ?? entries[0]
      const origin: Base = {
        facts: { ...act.def?.facts, ...entry?.facts },
        items: [...(entry?.items ?? [])],
        seen: [],
      }
      let now = states.map((s) => ({ state: s, base: copy(origin) }))
      const run = (id: string, from: string): void => {
        const g = graphs.get(id)
        if (g === undefined) {
          add(
            'error',
            'dialogue',
            `${act.scene}/${from}`,
            `starts ${id}, which is not a graph of ${act.scene}`,
          )
          return
        }
        started.add(g.id)
        const after = new Map<string, { state: DialogueState; base: Base }>()
        for (const { state: s, base } of now) {
          if (g === finale) arrivals.push(s.stance)
          const w = walk(g, s, base, bounds)
          for (const node of w.stuck)
            add(
              'error',
              'stuck',
              `${g.id}/${node}`,
              `on route ${route.name} no choice is on offer and there is no next`,
            )
          for (const o of w.offered) {
            const end = endingOf(o.choice)
            if (end !== null) offeredEndings.add(end)
          }
          for (const e of w.ends) after.set(JSON.stringify([e, base]), { state: e, base })
        }
        now = [...after.values()]
      }
      const follows = 'follow' in route ? (route.follow ?? []) : []
      const follow = (n: number): void => {
        for (const f of follows) if (f.after === n) run(f.graph, `follows step ${n}`)
      }
      follow(0)
      route.actions.forEach((id, i) => {
        const action = actions.get(id)
        // A systemic pseudo-step is the solver's, not the game's: no action, nothing to play.
        if (action !== undefined) {
          // The action's own effects first: a dialogue starts after them.
          for (const e of action.then)
            if (!('dialogue' in e)) for (const { base } of now) applyEffect(base, e)
          for (const e of action.then) if ('dialogue' in e) run(e.dialogue, action.id)
        }
        follow(i + 1)
      })
      for (const { state: s } of now) next.set(JSON.stringify(s), s)
    }
    for (const g of act.graphs)
      if (!started.has(g.id)) add('warning', 'started', `${act.scene}/${g.id}`, 'no route starts this graph')
    states = [...next.values()]
    const values = states.map((s) => s.stance)
    acted.push({
      scene: act.scene,
      routes: act.routes.length,
      graphs: [...started],
      min: Math.min(...values),
      max: Math.max(...values),
      states: states.length,
    })
  }
  let registerResult: StanceResult['register'] = null
  let endings: StanceResult['endings'] = []
  if (register !== null) {
    registerResult =
      arrivals.length > 0
        ? { graph: register, min: Math.min(...arrivals), max: Math.max(...arrivals) }
        : { graph: register, min: Number.NaN, max: Number.NaN }
    if (arrivals.length === 0) add('error', 'register', register, 'no route reaches the register finale')
    const wanted = options.endings
    if (wanted !== undefined) {
      endings = wanted.map((ending) => ({ ending, reachable: offeredEndings.has(ending) }))
      for (const e of endings)
        if (!e.reachable)
          add('error', 'ending', e.ending, `no route and path offers the ${e.ending} ending at ${register}`)
      for (const end of offeredEndings)
        if (!wanted.includes(end))
          add(
            'error',
            'ending',
            end,
            `the register offers an ending the story does not have (${wanted.join(', ')})`,
          )
    }
  }
  return {
    ok: !findings.some((f) => f.level === 'error'),
    acts: acted,
    register: registerResult,
    endings,
    findings,
  }
}

export interface MotifInput {
  readonly scene: string
  readonly records: readonly LineRecord[]
  readonly shots: readonly { readonly cutscene: string; readonly motifs: readonly string[] }[]
}
export interface MotifResult {
  readonly scene: string
  readonly tags: Readonly<Record<string, string[]>>
  readonly distinct: number
  readonly ok: boolean
  readonly findings: readonly Finding[]
}
/** The motif tags an act carries, across its lines, files and cutscene shots: `least` or more distinct, all canon. */
export function motifs(input: MotifInput, canon: Pick<Canon, 'motifs'>, least = 3): MotifResult {
  const { findings, add } = collect()
  const known = new Set(canon.motifs ?? [])
  const tags: Record<string, string[]> = {}
  const tag = (motif: string, where: string): void => {
    if (!known.has(motif))
      add('error', 'motif', where, `'${motif}' is not a canon motif (${[...known].join(', ')})`)
    const at = tags[motif] ?? []
    tags[motif] = at
    at.push(where)
  }
  for (const r of input.records) for (const m of r.motifs ?? []) tag(m, r.id)
  for (const s of input.shots) for (const m of s.motifs) tag(m, `cutscene ${s.cutscene}`)
  const distinct = Object.keys(tags).filter((m) => known.has(m)).length
  if (distinct < least)
    add(
      'error',
      'motifs',
      input.scene,
      `${distinct} motif tags (${Object.keys(tags).join(', ') || 'none'}); an act carries at least ${least} across its lines, files and shots`,
    )
  return { scene: input.scene, tags, distinct, ok: !findings.some((f) => f.level === 'error'), findings }
}
