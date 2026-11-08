// What is wrong with a conversation, in words, and a walk through it. Both read the files the page holds; neither runs
// the game or the narrative tools (those need a scene module a game made in the editors does not have).
import type { DialogueGraph, DialogueNode, LinesFile } from '@automata/narrative/sim'
import type { Cond, Value } from '@automata/puzzle/sim'
import { depths, leadsTo, partWords, readingOrder } from './dialogue-model.ts'

export interface StructureProblem {
  /** The part it is about. */
  readonly part: string
  readonly words: string
}

const isExit = (node: DialogueNode): boolean => node.next === undefined && (node.choices ?? []).length === 0

/** Parts that can reach `target`, by walking the arrows backwards. */
function canReach(graph: DialogueGraph, target: string): Set<string> {
  const found = new Set([target])
  for (let grew = true; grew; ) {
    grew = false
    for (const [id, node] of Object.entries(graph.nodes))
      if (!found.has(id) && leadsTo(node).some((to) => found.has(to))) {
        found.add(id)
        grew = true
      }
  }
  return found
}

/**
 * The part that ends the conversation, when it has one: of the parts that end it, the one most parts lead to (the
 * ending everything runs into, not a branch someone just added), the first in reading order when they tie.
 */
export function wayOut(graph: DialogueGraph): string | undefined {
  const live = depths(graph)
  const exits = readingOrder(graph).filter((id) => live.has(id) && isExit(graph.nodes[id] as DialogueNode))
  const leading = (target: string): number =>
    Object.entries(graph.nodes).filter(([id, node]) => id !== target && leadsTo(node).includes(target)).length
  return exits.reduce<string | undefined>(
    (best, id) => (best === undefined || leading(id) > leading(best) ? id : best),
    undefined,
  )
}

export function structureProblems(graph: DialogueGraph, lines: LinesFile): StructureProblem[] {
  const problems: StructureProblem[] = []
  const known = new Set(lines.lines.map((line) => line.id))
  const live = depths(graph)
  const order = readingOrder(graph)

  for (const id of order) {
    const node = graph.nodes[id] as DialogueNode
    if (!live.has(id))
      problems.push({ part: id, words: `Nothing leads to ${partWords(id)}, so no one can reach it.` })
    if (node.say.some((line) => !known.has(line)))
      problems.push({ part: id, words: 'This part says a line that no longer exists.' })
    if ((node.choices ?? []).some((choice) => !known.has(choice.line)))
      problems.push({ part: id, words: 'This part offers a choice whose line no longer exists.' })
  }

  const exits = order.filter((id) => live.has(id) && isExit(graph.nodes[id] as DialogueNode))
  const exit = wayOut(graph)
  if (exit === undefined) {
    if (live.size > 0)
      problems.push({ part: graph.start, words: 'No part ends this conversation, so it never ends.' })
  } else if (exits.length > 1) {
    for (const second of exits.filter((id) => id !== exit))
      problems.push({
        part: second,
        words: `${partWords(second)} ends the conversation by itself. Make it go on to ${partWords(exit)}.`,
      })
  } else {
    const reaching = canReach(graph, exit)
    for (const id of order)
      if (live.has(id) && !reaching.has(id))
        problems.push({
          part: id,
          words: `${partWords(exit)} is never reached from here, so this conversation never ends.`,
        })
  }

  // A part with conditions is passed over when they fail, so something that goes straight to it needs somewhere to go on.
  const straight = new Set([
    graph.start,
    ...Object.values(graph.nodes).flatMap((n) => (n.next === undefined ? [] : [n.next])),
  ])
  for (const id of order) {
    const node = graph.nodes[id] as DialogueNode
    if ((node.when ?? []).length > 0 && straight.has(id) && node.next === undefined)
      problems.push({
        part: id,
        words: `Something leads straight to ${partWords(id)}, which only happens sometimes, so it needs a Then.`,
      })
  }
  return problems
}

export type Facts = Readonly<Record<string, Value>>

/** Whether a condition holds for a walk. The walk has no items, so it assumes the player has what is asked for. */
export function holds(cond: Cond, facts: Facts): boolean {
  if ('has' in cond) return true
  if ('not' in cond) return !holds(cond.not, facts)
  if ('any' in cond) return cond.any.some((inner) => holds(inner, facts))
  const value = facts[cond.fact]
  if (cond.is !== undefined) return value === cond.is
  const number = typeof value === 'number' ? value : 0
  return (
    (cond.atLeast === undefined || number >= cond.atLeast) &&
    (cond.atMost === undefined || number <= cond.atMost)
  )
}

export interface PartView {
  /** The part shown: the one asked for, or the first one after it whose conditions hold. */
  readonly at: string
  /** The line ids said, in order. */
  readonly said: readonly string[]
  readonly choices: readonly { readonly index: number; readonly line: string }[]
  /** Where "Next" goes, when the part has no choices. */
  readonly goesOn: string | undefined
  readonly ended: boolean
}

/** What the person sees at a part, passing over parts whose conditions fail (a part with none to pass to ends it). */
export function partView(graph: DialogueGraph, at: string, facts: Facts): PartView {
  let id = at
  for (let steps = 0; steps <= Object.keys(graph.nodes).length; steps += 1) {
    const node = graph.nodes[id]
    if (node === undefined) break
    if ((node.when ?? []).every((cond) => holds(cond, facts))) {
      const choices = (node.choices ?? []).map((choice, index) => ({ index, line: choice.line }))
      return { at: id, said: node.say, choices, goesOn: node.next, ended: isExit(node) }
    }
    if (node.next === undefined) return { at: id, said: [], choices: [], goesOn: undefined, ended: true }
    id = node.next
  }
  return { at: id, said: [], choices: [], goesOn: undefined, ended: true }
}

/** The part a choice leads to, with the facts it sets kept for the walk. */
export function playChoose(
  graph: DialogueGraph,
  at: string,
  facts: Facts,
  index: number,
): { at: string; facts: Facts } {
  const choice = graph.nodes[at]?.choices?.[index]
  if (choice === undefined) return { at, facts }
  return { at: choice.next, facts: { ...facts, ...choice.set } }
}
