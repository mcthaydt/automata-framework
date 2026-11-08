// A conversation as a branching script: its parts in reading order, a part's choices and what they do, and the edits
// that change them. A part's name is its key in the file; the person reads it as words ("browsing" is "Browsing") and
// types it as words, and `partIdOf` turns it back. The edits are the kit's content edits by key path.
import type { ContentEdit } from '@automata/editor/kit/documents'
import type { Choice, DialogueGraph, DialogueNode } from '@automata/narrative/sim'
import type { Cond, Value } from '@automata/puzzle/sim'
import { appendEdits } from '../../shared/fields.ts'
import { humanize } from '../../shared/id-words.ts'

export const partWords: (id: string) => string = humanize

/** A name a person typed, as the key it is saved under. */
export function partIdOf(name: string): string {
  const id = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return id === '' ? 'part' : id
}

/** Where a part can go next: its `next`, then each choice, in file order. */
export function leadsTo(node: DialogueNode): string[] {
  return [
    ...(node.next === undefined ? [] : [node.next]),
    ...(node.choices ?? []).map((choice) => choice.next),
  ]
}

/** The distance of each part from the start, by the shortest way; parts nothing reaches are absent. */
export function depths(graph: DialogueGraph): Map<string, number> {
  const depth = new Map<string, number>()
  if (graph.nodes[graph.start] === undefined) return depth
  depth.set(graph.start, 0)
  const queue = [graph.start]
  for (let at = 0; at < queue.length; at += 1) {
    const id = queue[at] as string
    for (const target of leadsTo(graph.nodes[id] as DialogueNode)) {
      if (depth.has(target) || graph.nodes[target] === undefined) continue
      depth.set(target, (depth.get(id) as number) + 1)
      queue.push(target)
    }
  }
  return depth
}

/** The start, then the parts by first reach (breadth first), then the parts nothing reaches, in file order. */
export function readingOrder(graph: DialogueGraph): string[] {
  const order = [...depths(graph)].sort((a, b) => a[1] - b[1]).map(([id]) => id)
  const seen = new Set(order)
  return [...order, ...Object.keys(graph.nodes).filter((id) => !seen.has(id))]
}

const spaced = (id: string): string =>
  id
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_.-]+/g, ' ')
    .trim()
    .toLowerCase()

export const factValueWords = (value: Value): string =>
  value === true ? 'yes' : value === false ? 'no' : String(value)

/** A condition as the sentence a person reads; `names` turns an item or fact id into the name the game shows. */
export function conditionWords(cond: Cond, names: (id: string) => string): string {
  if ('has' in cond) return `the player has the ${spaced(names(cond.has))}`
  if ('not' in cond) return `not (${conditionWords(cond.not, names)})`
  if ('any' in cond) return `any of (${cond.any.map((inner) => conditionWords(inner, names)).join(', ')})`
  const fact = spaced(names(cond.fact))
  if (cond.is !== undefined) return `${fact} is ${factValueWords(cond.is)}`
  if (cond.atLeast !== undefined && cond.atMost !== undefined)
    return `${fact} is between ${String(cond.atLeast)} and ${String(cond.atMost)}`
  if (cond.atLeast !== undefined) return `${fact} is at least ${String(cond.atLeast)}`
  if (cond.atMost !== undefined) return `${fact} is at most ${String(cond.atMost)}`
  return fact
}

/** A choice's standing, as the person reads it. */
export function stanceWords(stance: number | undefined): string {
  if (stance === undefined || stance === 0) return 'No change'
  return stance > 0 ? `Warmer +${String(stance)}` : `Colder −${String(-stance)}`
}

const nodePath = (graph: number, node: string): (string | number)[] => ['graphs', graph, 'nodes', node]

export function addChoiceEdit(
  graph: number,
  node: string,
  current: DialogueNode,
  choice: Choice,
): ContentEdit {
  const keyPath = [...nodePath(graph, node), 'choices']
  return current.choices === undefined ? { keyPath, insert: [choice] } : { keyPath, insert: choice }
}

export const removeChoiceEdit = (graph: number, node: string, index: number): ContentEdit => ({
  keyPath: [...nodePath(graph, node), 'choices', index],
  remove: true,
})

export const setNextEdit = (
  graph: number,
  node: string,
  index: number,
  before: string,
  next: string,
): ContentEdit => ({
  keyPath: [...nodePath(graph, node), 'choices', index, 'next'],
  expected: before,
  set: next,
})

/** Standing changed; no change at all removes the key. */
export function setStanceEdit(
  graph: number,
  node: string,
  index: number,
  before: number | undefined,
  stance: number,
): ContentEdit | undefined {
  const keyPath = [...nodePath(graph, node), 'choices', index, 'stance']
  if (stance === 0) return before === undefined ? undefined : { keyPath, remove: true }
  return before === undefined ? { keyPath, insert: stance } : { keyPath, expected: before, set: stance }
}

/** A fact a choice remembers: set, changed, or (with `undefined`) forgotten. */
export function choiceFactEdit(
  graph: number,
  node: string,
  index: number,
  set: Readonly<Record<string, Value>> | undefined,
  name: string,
  value: Value | undefined,
): ContentEdit | undefined {
  const base = [...nodePath(graph, node), 'choices', index, 'set']
  const has = set !== undefined && Object.hasOwn(set, name)
  if (value === undefined) {
    if (!has) return undefined
    return Object.keys(set).length === 1
      ? { keyPath: base, remove: true }
      : { keyPath: [...base, name], remove: true }
  }
  if (set === undefined) return { keyPath: base, insert: { [name]: value } }
  return has
    ? { keyPath: [...base, name], expected: set[name], set: value }
    : { keyPath: [...base, name], insert: value }
}

/** A new part that says nothing yet; it goes on to `next` (the conversation's way out) so it does not end it by itself. */
export const addPartEdit = (graph: number, id: string, next?: string): ContentEdit => ({
  keyPath: nodePath(graph, id),
  insert: next === undefined ? { say: [] } : { say: [], next },
})

/** Why a part cannot take this name, in words; `undefined` when it can. */
export function renameProblem(graph: DialogueGraph, from: string, name: string): string | undefined {
  if (name.trim() === '') return 'Give the part a name.'
  const id = partIdOf(name)
  return id !== from && Object.hasOwn(graph.nodes, id)
    ? `There is already a part called ${partWords(id)}.`
    : undefined
}

/**
 * Every place that names the part follows it: the start, every `next`, every choice's `next`. The part itself moves
 * under its new name (with any way back to itself renamed too) and the old one goes. One list, so one undo step.
 */
export function renamePartEdits(
  graph: number,
  conversation: DialogueGraph,
  from: string,
  to: string,
): ContentEdit[] {
  const edits: ContentEdit[] = []
  if (conversation.start === from)
    edits.push({ keyPath: ['graphs', graph, 'start'], expected: from, set: to })
  for (const [id, node] of Object.entries(conversation.nodes)) {
    if (id === from) continue
    if (node.next === from) edits.push({ keyPath: [...nodePath(graph, id), 'next'], expected: from, set: to })
    ;(node.choices ?? []).forEach((choice, index) => {
      if (choice.next === from)
        edits.push({ keyPath: [...nodePath(graph, id), 'choices', index, 'next'], expected: from, set: to })
    })
  }
  const node = conversation.nodes[from] as DialogueNode
  const moved: Record<string, unknown> = { ...node }
  if (node.next === from) moved.next = to
  if (node.choices !== undefined)
    moved.choices = node.choices.map((choice) => (choice.next === from ? { ...choice, next: to } : choice))
  edits.push({ keyPath: nodePath(graph, to), insert: moved })
  edits.push({ keyPath: nodePath(graph, from), remove: true })
  return edits
}

export interface MapBox {
  readonly id: string
  readonly row: number
  readonly col: number
}
export interface MapArrow {
  readonly from: string
  readonly to: string
  /** True for a way back to a part at or above this one: drawn as a loop. */
  readonly back: boolean
}

/** Boxes in rows by distance from the start (parts nothing reaches in a last row) and the arrows between them. */
export function layoutConversation(graph: DialogueGraph): { boxes: MapBox[]; arrows: MapArrow[] } {
  const depth = depths(graph)
  const deepest = Math.max(-1, ...depth.values())
  const rowOf = (id: string): number => depth.get(id) ?? deepest + 1
  const filled = new Map<number, number>()
  const boxes = readingOrder(graph).map((id) => {
    const row = rowOf(id)
    const col = filled.get(row) ?? 0
    filled.set(row, col + 1)
    return { id, row, col }
  })
  const arrows: MapArrow[] = []
  for (const [id, node] of Object.entries(graph.nodes))
    for (const to of leadsTo(node))
      if (graph.nodes[to] !== undefined) arrows.push({ from: id, to, back: rowOf(to) <= rowOf(id) })
  return { boxes, arrows }
}

/** What a person can ask of a part, before it is said: a fact, or an item the player carries. */
export type OnlyIf =
  | { readonly kind: 'is'; readonly name: string; readonly value: string }
  | { readonly kind: 'atLeast' | 'atMost'; readonly name: string; readonly value: string }
  | { readonly kind: 'has'; readonly name: string }

/** The condition a person built, or why it cannot be (words). */
export function onlyIfCond(ask: OnlyIf): Cond | string {
  if (ask.name.trim() === '') return ask.kind === 'has' ? 'Say which item.' : 'Say which fact.'
  const id = partIdOf(ask.name)
  if (ask.kind === 'has') return { has: id }
  const text = ask.value.trim()
  if (ask.kind === 'is')
    return {
      fact: id,
      is:
        text === 'yes' || text === 'true'
          ? true
          : text === 'no' || text === 'false'
            ? false
            : /^-?\d+(\.\d+)?$/.test(text)
              ? Number(text)
              : text,
    }
  if (!/^-?\d+(\.\d+)?$/.test(text))
    return `“${ask.kind === 'atLeast' ? 'is at least' : 'is at most'}” needs a number, like 2.`
  return { fact: id, [ask.kind]: Number(text) } as Cond
}

/** A condition added to a part: the part's list of them is made first when it has none. */
export const addConditionEdits = (
  graph: number,
  node: string,
  has: DialogueNode,
  cond: Cond,
): ContentEdit[] => appendEdits([...nodePath(graph, node), 'when'], has.when !== undefined, cond)
