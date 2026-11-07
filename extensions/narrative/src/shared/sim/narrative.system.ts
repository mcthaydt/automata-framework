// Narrative's systems and the sim functions a game and puzzle's hooks call. A conversation moves
// only on `narrative.start`, `advance` and `choose` (or puzzle's `{ dialogue }` effect); each move says the place's
// line and, with its last line, the choices on offer. The storylets step each tick from the player's room (sectors'
// `InSector`, as of the last step's membership) and whether it moved, and play on verbs and system events.
import {
  PuzzleSceneResource,
  PuzzleState,
  type Reader,
  type Value,
  type VerbReport,
} from '@automata/puzzle/sim'
import { InSector, resolvedMap } from '@automata/sectors/sim'
import { defineSystem, type SimContext, type SystemDef } from '@automata/sim'
import { advance, applyChoice, choose, type Place, readerOf, settle, start, view } from './dialogue'
import type { DialogueGraph } from './dialogue.schema'
import { AdvanceCommand, ChooseCommand, StartCommand } from './narrative.command'
import { NarrativeChoices, NarrativeEnded, NarrativeLine, NarrativeStorylet } from './narrative.event'
import {
  NarrativeDialogue,
  NarrativeEnv,
  NarrativeSceneResource,
  NarrativeStorylets,
} from './narrative.resource'
import { type Here, type Outcome, onStep, onSystem, onVerb, type Room } from './storylets'

export interface NarrativeOptions {
  /** Facts the game keeps in its own fields (as puzzle's `facts.get`): undefined for a fact it does not map. */
  readonly facts?: (ctx: SimContext, name: string) => Value | undefined
  /** While this holds (a cutscene is playing), the conversation commands are ignored (the `cutscenes` extension's `locked`). */
  readonly locked?: (ctx: SimContext) => boolean
}

/** Puzzle's facts and items, under the game's own facts, with `read.<hotspot>` for a hotspot an action was taken at. */
function baseReader(ctx: SimContext, options: NarrativeOptions): Reader {
  const puzzle = ctx.resource(PuzzleState)
  return {
    fact: (name) => {
      const own = options.facts?.(ctx, name)
      if (own !== undefined) return own
      if (name.startsWith('read.')) {
        const def = ctx.resource(PuzzleSceneResource).def
        const at = name.slice(5)
        return def?.actions.some((a) => a.at === at && puzzle.seen.includes(a.id)) ?? false
      }
      return puzzle.facts[name]
    },
    has: (item) => puzzle.items.includes(item),
  }
}

/** The reader conditions use: stance, the dialogue's facts, then the base. */
const readerFor = (ctx: SimContext, options: NarrativeOptions): Reader =>
  readerOf(ctx.resource(NarrativeDialogue), baseReader(ctx, options))

const graphOf = (ctx: SimContext, id: string): DialogueGraph | undefined =>
  ctx.resource(NarrativeSceneResource).graphs.find((g) => g.id === id)

/** Moves the conversation to `place`: its line and choices, or its end. */
function moveTo(ctx: SimContext, graph: DialogueGraph, place: Place | null, r: Reader): void {
  const dialogue = ctx.resource(NarrativeDialogue)
  const seen = view(graph, place, r)
  if (place === null || seen === null) {
    dialogue.graph = null
    dialogue.place = null
    ctx.emit(NarrativeEnded, { graph: graph.id })
    return
  }
  dialogue.graph = graph.id
  dialogue.place = { node: place.node, line: place.line }
  if (seen.line !== null) ctx.emit(NarrativeLine, { graph: graph.id, id: seen.line })
  if (seen.choices.length > 0) ctx.emit(NarrativeChoices, { graph: graph.id, choices: [...seen.choices] })
}

/** Starts graph `id` (a graph the scene does not have is a content error the lints catch; here it does nothing). */
export function startDialogue(ctx: SimContext, id: string, options: NarrativeOptions = {}): void {
  const graph = graphOf(ctx, id)
  if (graph === undefined) return
  const r = readerFor(ctx, options)
  moveTo(ctx, graph, start(graph, r), r)
}

function advanceDialogue(ctx: SimContext, options: NarrativeOptions): void {
  const { graph: id, place } = ctx.resource(NarrativeDialogue)
  const graph = id === null ? undefined : graphOf(ctx, id)
  if (graph === undefined) return
  const r = readerFor(ctx, options)
  const next = advance(graph, place, r)
  // The same place: a choice is waiting, so an advance does nothing.
  if (next !== place) moveTo(ctx, graph, next, r)
}

function chooseAnswer(ctx: SimContext, index: number, options: NarrativeOptions): void {
  const dialogue = ctx.resource(NarrativeDialogue)
  const graph = dialogue.graph === null ? undefined : graphOf(ctx, dialogue.graph)
  if (graph === undefined) return
  const picked = choose(graph, dialogue.place, index, readerFor(ctx, options))
  if (picked === null) return
  const changed = applyChoice(dialogue, picked.choice, ctx.resource(NarrativeSceneResource).bounds)
  dialogue.stance = changed.stance
  dialogue.facts = { ...changed.facts }
  // The target settles with the choice applied, so its own facts gate where it goes (as in the original).
  const r = readerFor(ctx, options)
  const node = settle(graph, picked.choice.next, r)
  moveTo(ctx, graph, node === null ? null : { node, line: 0 }, r)
}

export const dialogueSystem = (options: NarrativeOptions): SystemDef =>
  defineSystem('narrative.dialogue', 'gameplay', (ctx) => {
    if (options.locked?.(ctx) === true) return
    for (const { payload } of ctx.commands.of(StartCommand)) startDialogue(ctx, payload.graph, options)
    for (const _ of ctx.commands.of(AdvanceCommand)) advanceDialogue(ctx, options)
    for (const { payload } of ctx.commands.of(ChooseCommand)) chooseAnswer(ctx, payload.index, options)
  })

/** Takes a storylet outcome: the state kept, each play emitted. */
function take(ctx: SimContext, out: Outcome): void {
  const state = ctx.resource(NarrativeStorylets) as {
    played: Record<string, number>
    still: number | null
    queued: { id: string; at: number } | null
    room: Room | null
  }
  state.played = { ...out.state.played }
  state.still = out.state.still
  state.queued = out.state.queued === null ? null : { ...out.state.queued }
  state.room = out.state.room === null ? null : { ...out.state.room }
  for (const p of out.plays) ctx.emit(NarrativeStorylet, { id: p.id, line: p.line })
}

/** Puzzle's `verb` hook: a bare-hand verb at a hotspot fires its inspect storylet. */
export function heardVerb(ctx: SimContext, report: VerbReport, options: NarrativeOptions = {}): void {
  const { deck } = ctx.resource(NarrativeSceneResource)
  const state = ctx.resource(NarrativeStorylets)
  take(ctx, onVerb(deck, state, report, { tick: ctx.tick, dt: ctx.dt }, readerFor(ctx, options)))
}

/** A game's system event by name (`system:<event>`). */
export function fireSystem(ctx: SimContext, event: string, options: NarrativeOptions = {}): void {
  const { deck } = ctx.resource(NarrativeSceneResource)
  take(ctx, onSystem(deck, ctx.resource(NarrativeStorylets), event, readerFor(ctx, options)))
}

/** The player's room and whether it moved since the last step; the plan position is kept for the next. */
function here(ctx: SimContext): Here {
  const env = ctx.resource(NarrativeEnv)
  const walker = env.player === null ? undefined : ctx.entity(env.player)
  if (walker === undefined || !walker.has(InSector)) {
    env.last = null
    return { room: null, moving: false }
  }
  const { x, z, sector } = walker.get(InSector)
  const moving = env.last !== null && (env.last.x !== x || env.last.z !== z)
  env.last = { x, z }
  const s = sector === 0 ? undefined : resolvedMap(ctx).sectors[sector - 1]
  return { room: s === undefined ? null : { sector: s.id, zone: s.zone }, moving }
}

export const storyletSystem = (options: NarrativeOptions): SystemDef =>
  defineSystem('narrative.storylets', 'gameplay', (ctx) => {
    const { deck } = ctx.resource(NarrativeSceneResource)
    const now = here(ctx)
    if (deck.length === 0) return
    take(
      ctx,
      onStep(
        deck,
        ctx.resource(NarrativeStorylets),
        now,
        { tick: ctx.tick, dt: ctx.dt },
        readerFor(ctx, options),
      ),
    )
  })
