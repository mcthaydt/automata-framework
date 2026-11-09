// Traces: the puzzle solver's routes played in the real sim, with
// puzzle and narrative loaded, recording what the player is shown in play order: messages as line ids, items gained,
// storylets, conversations (the lines every path says before its first choice) and cutscenes. Beat coverage, the hint
// cross-check and the screenplay read these traces. The game gives `TraceGame` the sim it plays in; nothing here
// walks the player (the sim takes a verb as the game's walker arrives), so a route is its steps' verbs in order.
import { PuzzleCutscene, PuzzleDialogue, PuzzleSaid, PuzzleState } from '@automata/puzzle/sim'
import { createSolver, describe, type PuzzleScene, routesOf, type Step } from '@automata/puzzle/solver'
import type { Command, Sim } from '@automata/sim'
import type { DialogueGraph } from '../../shared/sim/dialogue.schema'
import type { LineRecord } from '../../shared/sim/lines.schema'
import { NarrativeStorylet } from '../../shared/sim/narrative.event'
import { AFTER } from '../../shared/sim/storylets'

/** What a game gives the tracer. */
export interface TraceGame {
  /** The scene id: a line's record id is `<scene>.<name>`. */
  readonly scene: string
  /** The scene's solver adapter: its puzzle, its model and what the doc needs to name a step. */
  readonly puzzle: PuzzleScene
  readonly records: readonly LineRecord[]
  readonly graphs: readonly DialogueGraph[]
  /** A fresh sim with the scene's puzzle (from entry `entry`) and narrative loaded and the player at the start. */
  create(entry: string): Promise<Sim>
  /** The orders that set up a systemic step (a leak, a pursuer's arrival), which is no verb. */
  systemic?(step: Step): readonly Order[]
  /** A cutscene: how long it runs and the line ids its captions say (cutscenes are the game's). */
  cutscene?(id: string): { readonly duration: number; readonly captions: readonly string[] }
}
export type Order = Pick<Command, 'type' | 'payload'>

/** One thing the player saw or did, in play order. `at` is seconds of play. */
export type TraceEvent =
  | {
      readonly kind: 'step'
      readonly n: number
      readonly action: string
      readonly text: string
      readonly at: number
    }
  /** A line shown; `title` is where it came from, `storylet` the storylet that played it. */
  | {
      readonly kind: 'line'
      readonly id: string
      readonly title: string
      readonly at: number
      readonly storylet?: string | undefined
    }
  /** An item gained: its name record and its description record. */
  | {
      readonly kind: 'item'
      readonly item: string
      readonly name: string
      readonly text: string
      readonly at: number
    }
  | {
      readonly kind: 'cutscene'
      readonly id: string
      readonly duration: number
      readonly captions: readonly string[]
      readonly at: number
    }
  /** A conversation; `said` is the lines every path through it says before its first choice. */
  | { readonly kind: 'dialogue'; readonly id: string; readonly said: readonly string[]; readonly at: number }
  /** A message whose text is no line record. */
  | { readonly kind: 'unrecorded'; readonly text: string; readonly at: number }
export interface Trace {
  readonly route: string
  readonly entry: string
  readonly events: readonly TraceEvent[]
  /** The puzzle's goal held at the end. */
  readonly goal: boolean
}
export interface PlayRoute {
  readonly name: string
  readonly entry: string
  readonly steps: readonly Step[]
}

/** The solver's routes from each entry: the shortest, then one per distinct key-set. Named by entry when there are several. */
export function solverRoutes(puzzle: PuzzleScene): PlayRoute[] {
  const { def, model } = puzzle
  return def.entry.flatMap((e) =>
    routesOf(createSolver({ ...def, entry: [e] }, model).solve()).map((r) => ({
      name: def.entry.length > 1 ? `${e.name}: ${r.name}` : r.name,
      entry: e.name,
      steps: r.solution.steps,
    })),
  )
}

/** Every line id a trace showed, in order: messages, item names and texts, cutscene captions, and what a conversation always says. */
export function shown(trace: Trace): string[] {
  return trace.events.flatMap((e) =>
    e.kind === 'line'
      ? [e.id]
      : e.kind === 'item'
        ? [e.name, e.text]
        : e.kind === 'cutscene'
          ? [...e.captions]
          : e.kind === 'dialogue'
            ? [...e.said]
            : [],
  )
}

/** The lines a conversation says before its first choice: on every path. */
export function saidFirst(graph: DialogueGraph | undefined): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  let id: string | undefined = graph?.start
  while (graph !== undefined && id !== undefined && !seen.has(id)) {
    const node = graph.nodes[id]
    if (node === undefined) break
    seen.add(id)
    out.push(...node.say)
    id = (node.choices ?? []).length > 0 ? undefined : node.next
  }
  return out
}

/** The verb a step makes, as puzzle's command takes it. */
function verbOf(puzzle: PuzzleScene, step: Step): Order {
  const payload =
    step.at === 'code'
      ? { at: 'code', code: step.code ?? '' }
      : step.at === 'combine'
        ? { at: 'combine', pair: step.pair }
        : step.at === 'floor'
          ? { at: 'floor', point: puzzle.spawn, ...(step.held === undefined ? {} : { held: step.held }) }
          : { at: step.at, ...(step.held === undefined ? {} : { held: step.held }) }
  return { type: 'puzzle.verb', payload }
}

export interface PlayOptions {
  /** Play only the first `upTo` steps (default all). */
  readonly upTo?: number | undefined
  /** Then take one more step (a hint probe). */
  readonly then?: Step | undefined
}

/**
 * Plays `route` in a fresh sim and returns what it showed. After each verb the sim runs on long enough for a storylet
 * that follows the action's line (`AFTER` seconds) to play. Throws when a systemic step has no orders from the game.
 */
export async function play(game: TraceGame, route: PlayRoute, options: PlayOptions = {}): Promise<Trace> {
  const sim = await game.create(route.entry)
  try {
    const records = new Set(game.records.map((r) => r.id))
    const graphs = new Map(game.graphs.map((g) => [g.id, g]))
    const events: TraceEvent[] = []
    let seq = 0
    const at = (): number => Math.round((sim.tick / sim.tickHz) * 10) / 10
    const lineId = (say: string): string => `${game.scene}.${say}`
    const send = (orders: readonly Order[], ticks: number): void => {
      let first = true
      for (let i = 0; i < ticks; i++) {
        const commands = first ? orders.map((o) => ({ tick: sim.tick, source: 0, seq: seq++, ...o })) : []
        first = false
        for (const e of sim.step(commands).events) {
          const p = e.payload as Record<string, unknown>
          if (e.type === PuzzleSaid.id) {
            const id = lineId(p.line as string)
            events.push(
              records.has(id)
                ? { kind: 'line', id, title: p.at as string, at: at() }
                : { kind: 'unrecorded', text: p.line as string, at: at() },
            )
            for (const item of p.gained as string[]) {
              const name = `${game.scene}.item.${item}.name`
              const text = `${game.scene}.item.${item}`
              events.push(
                records.has(name) && records.has(text)
                  ? { kind: 'item', item, name, text, at: at() }
                  : { kind: 'unrecorded', text: `item ${item}`, at: at() },
              )
            }
          } else if (e.type === NarrativeStorylet.id) {
            events.push({
              kind: 'line',
              id: p.line as string,
              title: `storylet:${p.id as string}`,
              at: at(),
              storylet: p.id as string,
            })
          } else if (e.type === PuzzleDialogue.id)
            events.push({
              kind: 'dialogue',
              id: p.id as string,
              said: saidFirst(graphs.get(p.id as string)),
              at: at(),
            })
          else if (e.type === PuzzleCutscene.id) {
            const c = game.cutscene?.(p.id as string) ?? { duration: 0, captions: [] }
            events.push({
              kind: 'cutscene',
              id: p.id as string,
              duration: c.duration,
              captions: [...c.captions],
              at: at(),
            })
          }
        }
      }
    }
    // A storylet that follows an action's line waits AFTER seconds; run on a little past it.
    const settle = Math.ceil(AFTER * sim.tickHz) + 5
    const run = (step: Step, n: number): void => {
      events.push({ kind: 'step', n, action: step.action, text: describe(game.puzzle, step), at: at() })
      if (step.systemic === true) {
        const orders = game.systemic?.(step)
        if (orders === undefined)
          throw new Error(`${route.name}: the game gives no orders for ${step.action}`)
        send(orders, settle)
      } else send([verbOf(game.puzzle, step)], settle)
    }
    const upTo = options.upTo ?? route.steps.length
    for (const [i, s] of route.steps.slice(0, upTo).entries()) run(s, i + 1)
    if (options.then !== undefined) run(options.then, upTo + 1)
    return { route: route.name, entry: route.entry, events, goal: sim.resource(PuzzleState).goal }
  } finally {
    sim.dispose()
  }
}

/** Every route played to the end. */
export async function traces(
  game: TraceGame,
  routes: readonly PlayRoute[] = solverRoutes(game.puzzle),
): Promise<Trace[]> {
  const out: Trace[] = []
  for (const r of routes) out.push(await play(game, r))
  return out
}
