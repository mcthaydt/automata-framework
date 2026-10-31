// The verb system (M6 spec §4.5), from the adventure source's `createPuzzle`: each `puzzle.verb` finds the first
// matching action and applies its effects in order, then says its line; effects that must follow the line (a
// checkpoint, a cutscene, an exit, a dialogue) are emitted after it, or at once when the action has no line. A verb
// that matches nothing says its fallback line. The goal is reported the first time it holds.
import { defineSystem, type SimContext, type SystemDef } from '@mcthaydt/automata-sim'
import { fallbackLine, holds, match, type Reader, type Verb } from './interpret'
import { VerbCommand } from './puzzle.command'
import {
  PuzzleCheckpoint,
  PuzzleCutscene,
  PuzzleDialogue,
  PuzzleExit,
  PuzzleGave,
  PuzzleGoal,
  PuzzleKeypad,
  PuzzleNoise,
  PuzzleSaid,
} from './puzzle.event'
import { PuzzleSceneResource, PuzzleState } from './puzzle.resource'
import type { Action, Effect, PuzzleDef } from './puzzle.schema'
import type { Value } from './value.schema'

/** What a `{ call }` effect hands the game's function: the action and what the verb held or pointed at. */
export interface PuzzleCall {
  readonly action: string
  readonly held: string | undefined
  readonly pair: readonly [string, string] | undefined
  readonly point: { readonly x: number; readonly z: number } | undefined
}

export interface PuzzleOptions {
  /**
   * The game's functions for `{ call }` effects, by name. They run inside the verb system, on the verb's step, so
   * they may change sim state like any system (P6-D2 as built: the sim has no reading of a step's own events).
   */
  readonly calls?: Readonly<Record<string, (ctx: SimContext, call: PuzzleCall) => void>>
  /**
   * Facts the game keeps in its own fields: `get` returns undefined for a fact it does not map, and `set` returns false
   * for one; those facts live in `puzzle.state`.
   */
  readonly facts?: {
    get(ctx: SimContext, name: string): Value | undefined
    set(ctx: SimContext, name: string, value: Value): boolean
  }
}

function runVerb(ctx: SimContext, def: PuzzleDef, input: Verb, options: PuzzleOptions): void {
  const state = ctx.resource(PuzzleState)
  const reader: Reader = {
    fact: (name) => options.facts?.get(ctx, name) ?? state.facts[name],
    has: (item) => state.items.includes(item),
  }
  const setFact = (name: string, value: Value): void => {
    if (!options.facts?.set(ctx, name, value)) state.facts[name] = value
  }
  // The verbs check what is carried first, as the source's interact, useAt and combine do.
  let verb = input
  if (verb.at === 'floor' && !(verb.held && reader.has(verb.held))) return
  if (verb.at === 'combine' && !(verb.pair && reader.has(verb.pair[0]) && reader.has(verb.pair[1]))) return
  if (verb.held !== undefined && !reader.has(verb.held)) verb = { ...verb, held: undefined }

  const action = match(def, reader, verb)
  if (!action) {
    const line = fallbackLine(def, verb)
    if (line !== undefined) ctx.emit(PuzzleSaid, { action: null, at: verb.at, line, gained: [] })
    return
  }
  const gained: string[] = []
  const late: (() => void)[] = []
  const later = (emit: () => void): void => {
    if (action.say) late.push(emit)
    else emit()
  }
  for (const effect of action.then)
    applyEffect(ctx, def, verb, action, effect, { setFact, reader, gained, later }, options)
  state.seen.push(action.id)
  if (action.say) ctx.emit(PuzzleSaid, { action: action.id, at: verb.at, line: action.say, gained })
  for (const emit of late) emit()
  if (!state.goal && def.goal.every((c) => holds(reader, { at: '' }, c))) {
    state.goal = true
    ctx.emit(PuzzleGoal, {})
  }
}

interface Apply {
  setFact(name: string, value: Value): void
  readonly reader: Reader
  readonly gained: string[]
  later(emit: () => void): void
}

function applyEffect(
  ctx: SimContext,
  def: PuzzleDef,
  verb: Verb,
  action: Action,
  e: Effect,
  at: Apply,
  options: PuzzleOptions,
): void {
  const state = ctx.resource(PuzzleState)
  if ('set' in e) at.setFact(e.set, e.to)
  else if ('add' in e) at.setFact(e.add, Number(at.reader.fact(e.add) ?? 0) + e.by)
  else if ('give' in e) {
    state.items = [...state.items, e.give].sort()
    at.gained.push(e.give)
    ctx.emit(PuzzleGave, { item: e.give })
  } else if ('take' in e) {
    const i = state.items.indexOf(e.take)
    if (i >= 0) state.items.splice(i, 1)
  } else if ('noise' in e) {
    const where = typeof e.noise.at === 'string' ? def.hotspots[e.noise.at] : e.noise.at
    if (where === undefined) throw new Error(`${def.scene}: no hotspot "${String(e.noise.at)}" for a noise`)
    ctx.emit(PuzzleNoise, { at: { x: where.x, z: where.z }, loudness: e.noise.loudness, kind: e.noise.kind })
  } else if ('cutscene' in e) at.later(() => ctx.emit(PuzzleCutscene, { id: e.cutscene }))
  else if ('checkpoint' in e) at.later(() => ctx.emit(PuzzleCheckpoint, {}))
  else if ('keypad' in e) ctx.emit(PuzzleKeypad, {})
  else if ('exit' in e) at.later(() => ctx.emit(PuzzleExit, { to: e.exit.to, cutscene: e.exit.cutscene }))
  else if ('dialogue' in e) at.later(() => ctx.emit(PuzzleDialogue, { id: e.dialogue }))
  else {
    const call = options.calls?.[e.call]
    if (call === undefined) throw new Error(`${def.scene}: puzzle call "${e.call}" is not defined`)
    call(ctx, { action: action.id, held: verb.held, pair: verb.pair, point: verb.point })
  }
}

export const puzzleVerbSystem = (options: PuzzleOptions): SystemDef =>
  defineSystem('puzzle.verbs', 'gameplay', (ctx) => {
    const { def } = ctx.resource(PuzzleSceneResource)
    for (const { payload } of ctx.commands.of(VerbCommand)) if (def) runVerb(ctx, def, payload, options)
  })
