// A switch's tables rewritten in the behaviour file's text, and nothing else. The kit's patch writer is exact for a value
// (one literal, one span) but cannot yet add or remove an item of an array of tables that sits inside another one, which
// is how every switch's conditions and actions are written. So a structural change to a switch (a condition or an action
// added or taken out, a "not", a new or removed switch) replaces that switch's own tables as text, and every byte outside
// them stays. The caller reads the result back and compares it with the value it meant, so a text this cannot place is
// refused, never written wrong. A comment inside the replaced tables goes with them; a comment above them stays.
import { openDocument } from '@automata/editor/kit/documents'
import type { Transition } from '@automata/systems/sim'
import { parse as strictParse, stringify } from 'smol-toml'

export interface Header {
  /** The 0-based line of the `[table]` or `[[table]]` header. */
  readonly line: number
  /** The dotted name inside the brackets. */
  readonly name: string
  readonly array: boolean
}

const HEADER = /^\s*(\[\[?)\s*([^\][]+?)\s*\]\]?\s*(#.*)?$/

/** Every table header outside a multi-line string, in file order. */
export function headersOf(lines: readonly string[]): Header[] {
  const found: Header[] = []
  let open: string | undefined
  lines.forEach((line, i) => {
    if (open === undefined) {
      const match = HEADER.exec(line)
      if (match?.[1] !== undefined && match[2] !== undefined)
        found.push({ line: i, name: match[2], array: match[1] === '[[' })
    }
    for (const fence of ['"""', "'''"]) {
      const count = line.split(fence).length - 1
      if (open === undefined && count % 2 === 1) open = fence
      else if (open === fence && count % 2 === 1) open = undefined
    }
  })
  return found
}

/** The lists of tables a character owns that are rewritten as text: its switches, its patrol stops and its senses. */
export type CharacterList = 'transitions' | 'routine' | 'senses'

interface Place {
  /** The first line of the switch's own table. */
  readonly start: number
  /** One past its last line (its sub-tables included, the blank lines and comments after it not). */
  readonly end: number
}

/** The lines that hold character `agent`'s switch `index`, or where a new one goes (`index` past the last). */
function locate(
  lines: readonly string[],
  list: CharacterList,
  agent: number,
  index: number,
): Place | { readonly at: number } | undefined {
  const headers = headersOf(lines)
  const owners = headers.filter((h) => h.name === 'agents' && h.array)
  const owner = owners[agent]
  if (owner === undefined) return undefined
  const ownerEnd = owners[agent + 1]?.line ?? lines.length
  const mine = headers.filter((h) => h.line > owner.line && h.line < ownerEnd)
  // Past the owner's last table that belongs to the file's other parts, so a new table never lands in someone else's.
  const inside = mine.filter((h) => h.name === 'agents' || h.name.startsWith('agents.'))
  const own = `agents.${list}`
  const switches = inside.filter((h) => h.name === own && h.array)
  const trimmed = (end: number): number => {
    let at = end
    while (at > 0 && /^\s*(#.*)?$/.test(lines[at - 1] ?? '')) at -= 1
    return at
  }
  const endAfter = (header: Header): number => {
    const next = headers.find((h) => h.line > header.line && !h.name.startsWith(`${own}.`))
    return trimmed(Math.min(next?.line ?? lines.length, ownerEnd))
  }
  const target = switches[index]
  if (target !== undefined) return { start: target.line, end: endAfter(target) }
  if (index !== switches.length) return undefined
  const last = switches[switches.length - 1]
  if (last !== undefined) return { at: endAfter(last) }
  const lastInside = inside[inside.length - 1] ?? owner
  const next = headers.find((h) => h.line > lastInside.line && !h.name.startsWith(`${lastInside.name}.`))
  return { at: trimmed(Math.min(next?.line ?? lines.length, ownerEnd)) }
}

/** One switch as the text of its tables, without the empty `[[agents]]` the writer puts first. */
export function itemTables(list: CharacterList, item: unknown): string[] {
  const clean = JSON.parse(JSON.stringify(item)) as Record<string, unknown>
  const text = stringify({ agents: [{ [list]: [clean] }] })
  const lines = text.split('\n').slice(1)
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

export function splice(text: string, from: number, to: number, put: readonly string[]): string {
  const lines = text.split('\n')
  lines.splice(from, to - from, ...put)
  return lines.join('\n')
}

/** The line of character `agent`'s own `key = []` (an empty list written inline), or `undefined`. */
function inlineEmptyLine(lines: readonly string[], agent: number, list: CharacterList): number | undefined {
  const headers = headersOf(lines)
  const owner = headers.filter((h) => h.name === 'agents' && h.array)[agent]
  if (owner === undefined) return undefined
  const next = headers.find((h) => h.line > owner.line)?.line ?? lines.length
  const pattern = new RegExp(`^\\s*${list}\\s*=\\s*\\[\\s*\\]\\s*(#.*)?$`)
  for (let i = owner.line + 1; i < next; i += 1) if (pattern.test(lines[i] ?? '')) return i
  return undefined
}

/**
 * A list written inline and empty (`senses = []`) cannot also have `[[agents.senses]]` tables: the game's reader refuses
 * a key defined twice. The first item takes the inline line away; the last one out puts it back (the file needs the key,
 * except for a patrol, which may be absent).
 */
function withoutInlineEmpty(text: string, agent: number, list: CharacterList): string {
  const lines = text.split('\n')
  const at = inlineEmptyLine(lines, agent, list)
  if (at === undefined) return text
  lines.splice(at, 1)
  return lines.join('\n')
}

function withInlineEmpty(text: string, agent: number, list: CharacterList): string {
  if (list === 'routine') return text
  const lines = text.split('\n')
  const headers = headersOf(lines)
  const owner = headers.filter((h) => h.name === 'agents' && h.array)[agent]
  if (owner === undefined) return text
  lines.splice(owner.line + 1, 0, `${list} = []`)
  return lines.join('\n')
}

/** The text with character `agent`'s item `index` of `list` written as `next`, or `undefined` when the text has no such item. */
export function replaceItemText(
  text: string,
  list: CharacterList,
  agent: number,
  index: number,
  next: unknown,
): string | undefined {
  const place = locate(text.split('\n'), list, agent, index)
  if (place === undefined || !('start' in place)) return undefined
  return splice(text, place.start, place.end, itemTables(list, next))
}

/** The text without that switch (and the blank line that set it apart), or `undefined` when there is no such switch. */
export function removeItemText(
  text: string,
  list: CharacterList,
  agent: number,
  index: number,
): string | undefined {
  const lines = text.split('\n')
  const place = locate(lines, list, agent, index)
  if (place === undefined || !('start' in place)) return undefined
  const after = place.end < lines.length && (lines[place.end] ?? '').trim() === '' ? place.end + 1 : place.end
  return splice(text, place.start, after, [])
}

/** The text with a new item after character `agent`'s last of `list`, or `undefined` when there is no such character. */
export function appendItemText(
  text: string,
  list: CharacterList,
  agent: number,
  item: unknown,
  count: number,
): string | undefined {
  const lines = text.split('\n')
  const place = locate(lines, list, agent, count)
  if (place === undefined || !('at' in place)) return undefined
  return splice(text, place.at, place.at, ['', ...itemTables(list, item)])
}

// ── The change, checked ───────────────────────────────────────────────────────────────────────────────────────

export type ListChange =
  | {
      readonly kind: 'replace'
      readonly list: CharacterList
      readonly agent: number
      readonly index: number
      readonly next: unknown
    }
  | { readonly kind: 'remove'; readonly list: CharacterList; readonly agent: number; readonly index: number }
  | { readonly kind: 'add'; readonly list: CharacterList; readonly agent: number; readonly next: unknown }

/** A value as text with its keys in order, so two values that read the same compare the same. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (typeof value === 'object' && value !== null)
    return `{${Object.keys(value)
      .sort()
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(',')}}`
  return JSON.stringify(value) ?? 'null'
}

export const NOT_FOUND = 'That part of the file could not be found, so nothing was changed.'

/**
 * The file's text with one switch replaced, removed or added, or why not. The result is read back and must hold exactly
 * the file as it was with that one change, so a text this cannot place is refused and never written.
 */
export function changeListText(
  path: string,
  text: string,
  change: ListChange,
): { readonly text: string } | { readonly refused: string } {
  let intended: Record<string, unknown>
  try {
    intended = openDocument(path, text).value() as Record<string, unknown>
  } catch {
    return { refused: 'This file has a mistake, so it is read only until the mistake is fixed.' }
  }
  const owners = intended.agents
  const owner = Array.isArray(owners)
    ? (owners[change.agent] as Record<string, unknown> | undefined)
    : undefined
  if (owner === undefined) return { refused: NOT_FOUND }
  // A list the file does not have yet (no patrol): the first item makes it.
  if (owner[change.list] === undefined && change.kind === 'add') owner[change.list] = []
  const list = owner[change.list]
  if (!Array.isArray(list)) return { refused: NOT_FOUND }
  const copy = (value: unknown): unknown => JSON.parse(JSON.stringify(value))
  let next: string | undefined
  if (change.kind === 'replace') {
    next = replaceItemText(text, change.list, change.agent, change.index, change.next)
    list[change.index] = copy(change.next)
  } else if (change.kind === 'remove') {
    next = removeItemText(text, change.list, change.agent, change.index)
    if (next !== undefined && list.length === 1) next = withInlineEmpty(next, change.agent, change.list)
    list.splice(change.index, 1)
    // The last stop out takes the patrol with it, as the file never held an empty one.
    if (list.length === 0 && change.list === 'routine') delete owner[change.list]
  } else {
    const base = list.length === 0 ? withoutInlineEmpty(text, change.agent, change.list) : text
    next = appendItemText(base, change.list, change.agent, change.next, list.length)
    list.push(copy(change.next))
  }
  if (next === undefined) return { refused: NOT_FOUND }
  try {
    // Read back the way the game reads it (the strict parser) and the way the kit does: both must be the intended file.
    if (
      canonical(strictParse(next)) === canonical(intended) &&
      canonical(openDocument(path, next).value()) === canonical(intended)
    )
      return { text: next }
  } catch {
    // fall through
  }
  return { refused: NOT_FOUND }
}

/** The same, for a character's switches. */
export type SwitchChange =
  | { readonly kind: 'replace'; readonly agent: number; readonly index: number; readonly next: Transition }
  | { readonly kind: 'remove'; readonly agent: number; readonly index: number }
  | { readonly kind: 'add'; readonly agent: number; readonly next: Transition }

export const changeSwitchText = (
  path: string,
  text: string,
  change: SwitchChange,
): { readonly text: string } | { readonly refused: string } =>
  changeListText(path, text, { ...change, list: 'transitions' })
