// Puzzle help (M6.8b step 4; from the source's `help.ts`): the owner's two puzzle-design rules, woven into the world:
// every puzzle has three escalating hints (a nudge, a direction, then nearly the answer) and every important
// deduction about three clues, all of them lines the player meets by playing: what they interact with (objects,
// notes, examine lines) or hear (barks, dialogue, cutscenes). There is no hint button, hint voice or counter.
// `lintHelp` checks them, pure; `currentHint` is the puzzle in play.
import type { Cond, Reader } from '@mcthaydt/automata-puzzle/sim'
import { holds } from '@mcthaydt/automata-puzzle/sim'
import {
  createSolver,
  type PuzzleScene,
  type Route,
  routesOf,
  type State,
} from '@mcthaydt/automata-puzzle/solver'
import type { DialogueGraph, LineRecord } from '../sim/index'
import { collect, type Finding } from './finding'
import type { HintLadder, SceneHelp } from './help.schema'

/** The fewest clues a deduction has, and the fewest different places they come from. */
export const CLUES = 3
/** Rungs on every hint ladder: a nudge, a direction, nearly the answer. */
export const LEVELS = 3

/** The puzzle in play: the first ladder whose `done` does not hold, or null once every one is done. */
export function currentHint(help: SceneHelp | undefined, r: Reader): HintLadder | null {
  const done = (h: HintLadder): boolean =>
    h.done !== undefined && h.done.length > 0 && h.done.every((c: Cond) => holds(r, { at: '' }, c))
  return help?.hints.find((h) => !done(h)) ?? null
}
const readerOfState = (s: Pick<State, 'facts' | 'items'>): Reader => ({
  fact: (name) => s.facts[name],
  has: (item) => s.items.includes(item),
})

export interface HelpInput {
  readonly scene: string
  readonly help: SceneHelp | undefined
  readonly records: readonly LineRecord[]
  /** The puzzle's facts. */
  readonly facts: readonly string[]
  /** Where a line can be met in the world: hotspot ids, then `cutscene:<id>`, `item:<id>`, `dialogue:<graph>`, `bark:<agent>`. */
  readonly places: readonly string[]
  /** Line id → the hotspots of the puzzle actions that say it. */
  readonly says: Readonly<Record<string, readonly string[]>>
  /** Each solution route as the states it passes through (before each step, then after the last). */
  readonly routes: readonly {
    readonly name: string
    readonly states: readonly Pick<State, 'facts' | 'items'>[]
  }[]
}

const SPECIAL = new Set(['combine', 'floor', 'code'])
/**
 * What `lintHelp` needs from a scene: its lines, the places a clue can be met, who says what, and its solution routes
 * as states (`routes`: an analysis's, key-set routes included; by default the solver's shortest and its alternatives).
 */
export function helpInputOf(scene: {
  readonly puzzle: PuzzleScene
  readonly records: readonly LineRecord[]
  readonly graphs: readonly DialogueGraph[]
  readonly help: SceneHelp | undefined
  readonly routes?: readonly Route[] | undefined
}): HelpInput {
  const { puzzle, records } = scene
  const def = puzzle.def
  const keypad = def.actions.find((a) => !SPECIAL.has(a.at) && a.then.some((e) => 'keypad' in e))?.at
  const solver = createSolver(def, puzzle.model)
  const routes = scene.routes ?? routesOf(solver.solve())
  const says: Record<string, string[]> = {}
  for (const a of def.actions) {
    const at = a.at === 'code' ? keypad : SPECIAL.has(a.at) ? undefined : a.at
    if (a.say === '' || at === undefined) continue
    const id = `${def.scene}.${a.say}`
    says[id] = [...(says[id] ?? []), at]
  }
  const agents = [
    ...new Set(
      records.filter((r) => r.kind === 'bark' && r.speaker !== undefined).map((r) => r.speaker as string),
    ),
  ]
  const places = [
    ...Object.keys(def.hotspots),
    ...def.actions.map((a) => a.at).filter((at) => !SPECIAL.has(at)),
    ...puzzle.cutscenes.map((id) => `cutscene:${id}`),
    ...Object.keys(puzzle.story.items).map((id) => `item:${id}`),
    ...def.items.map((id) => `item:${id}`),
    ...scene.graphs.map((g) => `dialogue:${g.id}`),
    ...agents.map((id) => `bark:${id}`),
  ]
  return {
    scene: puzzle.id,
    help: scene.help,
    records,
    says,
    places: [...new Set(places)],
    facts: [...new Set([...Object.keys(def.facts), ...def.entry.flatMap((e) => Object.keys(e.facts ?? {}))])],
    routes: routes.map((r) => ({ name: r.name, states: solver.states(r.solution) })),
  }
}

const condFacts = (c: Cond): string[] =>
  'not' in c ? condFacts(c.not) : 'any' in c ? c.any.flatMap(condFacts) : 'fact' in c ? [c.fact] : []

export function lintHelp(input: HelpInput): Finding[] {
  const { findings, add } = collect()
  const { help, scene } = input
  const error = (rule: string, id: string, detail: string) => add('error', rule, id, detail)
  if (help === undefined) {
    error(
      'missing',
      scene,
      'no help for this scene: every puzzle needs three hints, every deduction three clues',
    )
    return findings
  }
  const byId = new Map(input.records.map((r) => [r.id, r]))
  const facts = new Set(input.facts)
  const places = new Set(input.places)
  if (help.hints.length === 0) error('hints', scene, 'no hint ladders: every puzzle in the scene needs one')
  /** A world line: in the story, not a UI line (an objective or a caught screen), met where `at` says. */
  const world = (owner: string, c: { line: string; at: string }) => {
    const r = byId.get(c.line)
    if (r === undefined) error('line', owner, `${c.line} is not in the story`)
    else if (r.kind === 'objective' || r.kind === 'caught')
      error(
        'kind',
        owner,
        `${c.line} is a ${r.kind} line, which is UI; use something the player interacts with or hears`,
      )
    if (!places.has(c.at))
      error(
        'at',
        owner,
        `${c.line} is met at ${c.at}, which is not a hotspot, cutscene, item, dialogue or agent of ${scene}`,
      )
    const said = input.says[c.line]
    if (said !== undefined && said.length > 0 && !said.includes(c.at))
      error('at', owner, `${c.line} is said at ${said.join(', ')}, not ${c.at}`)
  }
  // Rule 1: three escalating hints per puzzle, from three places in the world.
  const ladders = new Set<string>()
  help.hints.forEach((h, i) => {
    if (ladders.has(h.id)) error('id', h.id, 'the ladder id is used twice')
    ladders.add(h.id)
    if (h.levels.length !== LEVELS)
      error(
        'levels',
        h.id,
        `${h.levels.length} hints; every puzzle has ${LEVELS} (a nudge, a direction, nearly the answer)`,
      )
    else if (new Set(h.levels.map((c) => c.at)).size < LEVELS)
      error(
        'places',
        h.id,
        `its hints come from ${new Set(h.levels.map((c) => c.at)).size} places; they need ${LEVELS} different ones`,
      )
    for (const c of h.levels) world(h.id, c)
    if ((h.done ?? []).length === 0 && i < help.hints.length - 1)
      error('done', h.id, 'only the last ladder may have no `done`: it would hide every ladder after it')
    for (const f of (h.done ?? []).flatMap(condFacts))
      if (!facts.has(f)) error('fact', h.id, `done reads ${f}, which is not a puzzle fact`)
  })
  // Rule 2: about three clues per deduction, from different places; every puzzle rests on at least one.
  const deductions = new Set<string>()
  const covered = new Set<string>()
  for (const d of help.deductions) {
    if (deductions.has(d.id)) error('id', d.id, 'the deduction id is used twice')
    deductions.add(d.id)
    if (d.for.length === 0) error('for', d.id, 'needed by no puzzle')
    for (const l of d.for) {
      if (!ladders.has(l)) error('for', d.id, `${l} is not a hint ladder`)
      covered.add(l)
    }
    const where = new Set(d.clues.map((c) => c.at))
    if (d.clues.length < CLUES)
      error('clues', d.id, `${d.clues.length} clues; every deduction needs ${CLUES} (${d.learn})`)
    else if (where.size < CLUES)
      error(
        'places',
        d.id,
        `its clues come from ${where.size} places (${[...where].join(', ')}); they need ${CLUES} different ones`,
      )
    for (const c of d.clues) world(d.id, c)
    const kinds = new Set(d.clues.map((c) => byId.get(c.line)?.kind).filter((k) => k !== undefined))
    if (d.clues.length >= CLUES && kinds.size < 2)
      add(
        'warning',
        'kinds',
        d.id,
        `every clue is a ${[...kinds][0]} line; mix what the player hears, reads and handles`,
      )
  }
  for (const h of help.hints)
    if (!covered.has(h.id))
      error(
        'deduction',
        h.id,
        `no deduction is for this puzzle: name what the player must work out, with ${CLUES} clues`,
      )
  // Every step of every solution route has a puzzle to hint at, and every ladder is the current one somewhere.
  const current = new Set<string>()
  for (const route of input.routes) {
    const stuck = route.states.slice(0, -1).findIndex((s) => {
      const h = currentHint(help, readerOfState(s))
      if (h !== null) current.add(h.id)
      return h === null
    })
    if (stuck >= 0)
      error(
        'uncovered',
        route.name,
        `before step ${stuck + 1} every ladder is done, so that step belongs to no puzzle with hints`,
      )
  }
  if (input.routes.length > 0)
    for (const h of help.hints)
      if (!current.has(h.id))
        add(
          'warning',
          'never',
          h.id,
          'never the puzzle in play on any solution route: its `done` already holds, or an earlier ladder lasts too long',
        )
  return findings
}
