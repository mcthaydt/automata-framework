// What the puzzle page does to the puzzle file, as the kit's content edits, and what it refuses: an item or a fact that
// something still uses cannot be taken out, and the page says what uses it.

import type { ContentEdit } from '@automata/editor/kit/documents'
import type { Cond, Effect, PuzzleDef, Value } from '@automata/puzzle/sim'
import type { Names } from '../pieces/piece.ts'

/** The names the pieces' fields choose from. A puzzle has items, where a behaviour file has characters. */
export function puzzleNames(def: PuzzleDef): Names {
  const calls = new Set<string>()
  for (const action of def.actions) for (const e of action.then) if ('call' in e) calls.add(e.call)
  return {
    modes: [],
    agents: [],
    facts: Object.keys(def.facts),
    places: Object.keys(def.hotspots),
    hooks: [...calls],
    doorways: [],
    items: def.items,
  }
}

const readsFact = (c: Cond, name: string): boolean =>
  'not' in c
    ? readsFact(c.not, name)
    : 'any' in c
      ? c.any.some((x) => readsFact(x, name))
      : 'fact' in c && c.fact === name
const readsItem = (c: Cond, name: string): boolean =>
  'not' in c
    ? readsItem(c.not, name)
    : 'any' in c
      ? c.any.some((x) => readsItem(x, name))
      : 'has' in c && c.has === name
const writesFact = (e: Effect, name: string): boolean =>
  ('set' in e && e.set === name) || ('add' in e && e.add === name)
const touchesItem = (e: Effect, name: string): boolean =>
  ('give' in e && e.give === name) || ('take' in e && e.take === name)

/** Where an item or a fact is used, each as a few words ("the action crank-it", "the goal"). */
export function usedBy(def: PuzzleDef, kind: 'item' | 'fact', name: string): string[] {
  const found: string[] = []
  const reads = kind === 'fact' ? readsFact : readsItem
  const writes = kind === 'fact' ? writesFact : touchesItem
  if (kind === 'item')
    for (const entry of def.entry) if (entry.items.includes(name)) found.push(`the way in ${entry.name}`)
  if (kind === 'fact')
    for (const entry of def.entry)
      if (entry.facts !== undefined && name in entry.facts) found.push(`the way in ${entry.name}`)
  for (const action of def.actions) {
    const uses =
      (kind === 'item' &&
        (action.use === name || (Array.isArray(action.use) && action.use.includes(name)))) ||
      (action.when ?? []).some((c) => reads(c, name)) ||
      action.then.some((e) => writes(e, name))
    if (uses) found.push(`the action ${action.id}`)
  }
  if (def.goal.some((c) => reads(c, name))) found.push('the goal')
  for (const sys of def.systemic)
    if (sys.enables.some((c) => reads(c, name))) found.push(`the other way (${sys.id})`)
  return found
}

const NEEDS_NAME = (what: string): { refused: string } => ({
  refused: `A${what === 'item' ? 'n' : ''} ${what} needs a name.`,
})

export function addItemEdits(def: PuzzleDef, name: string): ContentEdit[] | { refused: string } {
  const id = name.trim()
  if (id === '') return NEEDS_NAME('item')
  if (def.items.includes(id)) return { refused: `There is already an item called “${id}”.` }
  return [{ keyPath: ['items'], insert: id }]
}

export function removeItemEdits(def: PuzzleDef, name: string): ContentEdit[] | { refused: string } {
  const at = def.items.indexOf(name)
  if (at < 0) return { refused: 'That item is not in this puzzle any more.' }
  const uses = usedBy(def, 'item', name)
  if (uses.length > 0)
    return { refused: `“${name}” is still used by ${uses.join(', ')}. Take it out of those first.` }
  return [{ keyPath: ['items', at], remove: true }]
}

export function addFactEdits(
  def: PuzzleDef,
  name: string,
  value: Value = false,
): ContentEdit[] | { refused: string } {
  const id = name.trim()
  if (id === '') return NEEDS_NAME('fact')
  if (id in def.facts) return { refused: `There is already a fact called “${id}”.` }
  return [{ keyPath: ['facts', id], insert: value }]
}

export function removeFactEdits(def: PuzzleDef, name: string): ContentEdit[] | { refused: string } {
  if (!(name in def.facts)) return { refused: 'That fact is not in this puzzle any more.' }
  const uses = usedBy(def, 'fact', name)
  if (uses.length > 0)
    return { refused: `“${name}” is still used by ${uses.join(', ')}. Take it out of those first.` }
  return [{ keyPath: ['facts', name], remove: true }]
}
