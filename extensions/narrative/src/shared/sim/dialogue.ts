// The dialogue runtime, as pure functions over a
// conversation's place (the graph's node and the line it is saying); the sim keeps the place in a resource. A node
// says its lines in order, then offers the player's choices or goes on to `next`. A node whose `when` fails is passed
// over: a `next` leads through it to its own `next`, and a choice that leads to it is not offered. Nothing advances
// on a timer: only `advance` and `choose` move a conversation.
import { type Cond, holds as condHolds, type Reader, type Value } from '@automata/puzzle/sim'
import type { Choice, DialogueGraph, DialogueNode } from './dialogue.schema'

/** What choices have changed: stance (clamped to the canon's bounds) and the facts they set. */
export interface DialogueState {
  readonly stance: number
  readonly facts: Readonly<Record<string, Value>>
}
/** Where a conversation is: a node and the index of the line it is saying. */
export interface Place {
  readonly node: string
  readonly line: number
}
/** What the player sees: the node, its line, and the choices once its last line is up. */
export interface View {
  readonly node: string
  readonly line: string | null
  readonly choices: readonly { readonly index: number; readonly line: string }[]
  /** No choice and no line after this one: the next advance ends the conversation. */
  readonly last: boolean
}

export const freshDialogue = (): DialogueState => ({ stance: 0, facts: {} })

const holds = (c: Cond, r: Reader): boolean => condHolds(r, { at: '' }, c)
export const passes = (node: DialogueNode, r: Reader): boolean => (node.when ?? []).every((c) => holds(c, r))

/** A dialogue state read over a base (puzzle's facts and items): `stance`, then the dialogue's facts, then the base. */
export function readerOf(state: DialogueState, base: Partial<Reader> = {}): Reader {
  return {
    fact: (name) =>
      name === 'stance'
        ? state.stance
        : Object.hasOwn(state.facts, name)
          ? state.facts[name]
          : base.fact?.(name),
    has: (item) => base.has?.(item) ?? false,
  }
}

/** A choice applied: stance moves by its amount, clamped to `bounds`, and its facts are set. A new state. */
export function applyChoice(
  state: DialogueState,
  choice: Pick<Choice, 'stance' | 'set'>,
  bounds: { readonly min: number; readonly max: number },
): DialogueState {
  const stance = Math.max(bounds.min, Math.min(bounds.max, state.stance + (choice.stance ?? 0)))
  return { stance, facts: { ...state.facts, ...choice.set } }
}

/** The choices a node offers now: those whose target node's `when` holds, with their index in the node. */
export function offered(
  graph: DialogueGraph,
  node: DialogueNode,
  r: Reader,
): { index: number; choice: Choice }[] {
  return (node.choices ?? [])
    .map((choice, index) => ({ index, choice }))
    .filter(({ choice }) => {
      const target = graph.nodes[choice.next]
      return target !== undefined && passes(target, r)
    })
}

/**
 * Where a conversation goes from `id`: past nodes whose `when` fails and past empty joins (no lines, no choices on
 * offer), following `next`. Null is the exit. A loop of skipped nodes is an error in the graph.
 */
export function settle(graph: DialogueGraph, id: string | undefined, r: Reader): string | null {
  const seen: string[] = []
  let at = id
  while (at !== undefined) {
    if (seen.includes(at)) throw new Error(`dialogue ${graph.id}: nodes ${seen.join(' > ')} skip in a loop`)
    seen.push(at)
    const node = graph.nodes[at]
    if (node === undefined) throw new Error(`dialogue ${graph.id}: no node ${at}`)
    if (passes(node, r) && (node.say.length > 0 || offered(graph, node, r).length > 0)) return at
    at = node.next
  }
  return null
}

const nodeOf = (graph: DialogueGraph, place: Place): DialogueNode => graph.nodes[place.node] as DialogueNode
const choicesNow = (graph: DialogueGraph, place: Place, r: Reader) => {
  const node = nodeOf(graph, place)
  return place.line >= node.say.length - 1 ? offered(graph, node, r) : []
}

/** Where a conversation starts, or null when every node is passed over. */
export function start(graph: DialogueGraph, r: Reader): Place | null {
  const node = settle(graph, graph.start, r)
  return node === null ? null : { node, line: 0 }
}

export function view(graph: DialogueGraph, place: Place | null, r: Reader): View | null {
  if (place === null) return null
  const node = nodeOf(graph, place)
  const choices = choicesNow(graph, place, r)
  const lastLine = place.line >= node.say.length - 1
  return {
    node: place.node,
    line: node.say[Math.min(place.line, node.say.length - 1)] ?? null,
    choices: choices.map((c) => ({ index: c.index, line: c.choice.line })),
    last: choices.length === 0 && lastLine && settle(graph, node.next, r) === null,
  }
}

/** The next line, or on past a node with nothing to choose; the same place while a choice is waiting; null at the end. */
export function advance(graph: DialogueGraph, place: Place | null, r: Reader): Place | null {
  if (place === null) return null
  if (choicesNow(graph, place, r).length > 0) return place
  const node = nodeOf(graph, place)
  if (place.line < node.say.length - 1) return { node: place.node, line: place.line + 1 }
  const next = settle(graph, node.next, r)
  return next === null ? null : { node: next, line: 0 }
}

/** Takes choice `index` (of the node's own list) when it is on offer: the choice, and where the conversation goes. */
export function choose(
  graph: DialogueGraph,
  place: Place | null,
  index: number,
  r: Reader,
): { choice: Choice; at: Place | null } | null {
  if (place === null) return null
  const pick = choicesNow(graph, place, r).find((c) => c.index === index)
  if (pick === undefined) return null
  const next = settle(graph, pick.choice.next, r)
  return { choice: pick.choice, at: next === null ? null : { node: next, line: 0 } }
}
