import { parseDocument, stringify } from '@decimalturn/toml-patch'
import { type KeyPath, keyPathText } from '../key-path'
import { isTable, keysOf, type Table } from '../values'

// New tables, written the way a person writes them. toml-patch writes a table it adds as an inline table (and a new list
// of tables as an inline array of them), at the top of the file or the section; a file that keeps its tables as
// `[sections]` then holds two styles, and the new one is harder to read by hand. This finds the tables a patch adds
// where the file already writes that kind as sections, takes them out of the value toml-patch is given, and writes each
// as a section after the last section of the same family. Where the file writes the place inline there is nothing to
// match, and the addition is left to toml-patch.

interface Position {
  readonly line: number
  readonly column: number
}
interface Node {
  readonly type: string
  readonly loc: { readonly start: Position; readonly end: Position }
}
interface TableNode extends Node {
  readonly key: { readonly item: { readonly value: readonly string[] } }
  readonly items: readonly Node[]
}

/** One `[table]` or `[[array]]` header with the body under it. */
interface Section {
  /** From the root, a list of tables indexed like any array. */
  readonly keyPath: KeyPath
  readonly array: boolean
  /** Where its last line of content ends (before the line break). */
  readonly end: number
}

function readSections(text: string): Section[] {
  const lineStarts = [0]
  for (let at = text.indexOf('\n'); at >= 0; at = text.indexOf('\n', at + 1)) lineStarts.push(at + 1)
  const offset = ({ line, column }: Position): number => (lineStarts[line - 1] ?? text.length) + column
  const lineEnd = (at: number): number => {
    const stop = text.indexOf('\n', at)
    const end = stop < 0 ? text.length : stop
    return end > at && text[end - 1] === '\r' ? end - 1 : end
  }
  const arrayCounts = new Map<string, number>()
  // A header names its table from the root; a key that is a list of tables so far means its last element.
  const resolve = (keys: readonly string[]): (string | number)[] => {
    const path: (string | number)[] = []
    for (const key of keys) {
      path.push(key)
      const count = arrayCounts.get(keyPathText(path))
      if (count !== undefined) path.push(count - 1)
    }
    return path
  }
  const sections: Section[] = []
  for (const block of parseDocument(text).cst as unknown as readonly Node[]) {
    if (block.type !== 'Table' && block.type !== 'TableArray') continue
    const table = block as TableNode
    const keys = table.key.item.value
    let keyPath: (string | number)[]
    if (block.type === 'TableArray') {
      const arrayPath = [...resolve(keys.slice(0, -1)), keys[keys.length - 1] as string]
      const count = arrayCounts.get(keyPathText(arrayPath)) ?? 0
      arrayCounts.set(keyPathText(arrayPath), count + 1)
      keyPath = [...arrayPath, count]
    } else keyPath = resolve(keys)
    // The body ends at its last key's line; a comment after it belongs to what follows.
    const last = [...table.items].reverse().find((item) => item.type !== 'Comment')
    const end = lineEnd(offset((last ?? block).loc[last === undefined ? 'start' : 'end']))
    sections.push({ keyPath, array: block.type === 'TableArray', end })
  }
  return sections
}

/** A table the patch adds, whole: `value` is the table, or for a new list the items. */
export interface Addition {
  readonly path: KeyPath
  readonly value: unknown
}

const isTableList = (value: unknown): value is Table[] =>
  Array.isArray(value) && value.length > 0 && value.every(isTable)

/** What the file's sections say: which paths are sections or lie above one, and which lists are lists of sections. */
function layoutOf(sections: readonly Section[]): { above: Set<string>; lists: Set<string> } {
  const above = new Set<string>()
  const lists = new Set<string>()
  for (const { keyPath, array } of sections) {
    for (let length = 1; length <= keyPath.length; length++) above.add(keyPathText(keyPath.slice(0, length)))
    if (array) lists.add(keyPathText(keyPath.slice(0, -1)))
  }
  return { above, lists }
}

/**
 * `next` without the tables it adds to `current` where the file writes sections, and those tables as additions in the
 * order they are to be written. A table added to a list is added only after the list's last item.
 */
export function splitAdditions(
  text: string,
  current: unknown,
  next: unknown,
): { readonly rest: unknown; readonly additions: Addition[] } {
  const { above, lists } = layoutOf(readSections(text))
  const additions: Addition[] = []
  // Whether a section can be written under `path`: the root, or a table the file writes by section.
  const canHold = (path: KeyPath): boolean => path.length === 0 || above.has(keyPathText(path))

  const walk = (here: unknown, there: unknown, path: KeyPath): unknown => {
    if (isTable(here) && isTable(there)) {
      const rest: Table = {}
      for (const key of keysOf(there)) {
        const value = there[key]
        const kept = here[key]
        if (kept === undefined && canHold(path) && (isTable(value) || isTableList(value)))
          additions.push({ path: [...path, key], value })
        else rest[key] = kept === undefined ? value : walk(kept, value, [...path, key])
      }
      return rest
    }
    if (Array.isArray(here) && Array.isArray(there)) {
      const shared = Math.min(here.length, there.length)
      const rest = there.slice(0, shared).map((item, index) => walk(here[index], item, [...path, index]))
      const tail = there.slice(shared)
      const more = here.length > 0 && lists.has(keyPathText(path)) && tail.length > 0 && tail.every(isTable)
      if (!more) return [...rest, ...tail]
      for (const [index, item] of tail.entries())
        additions.push({ path: [...path, shared + index], value: item })
      return rest
    }
    return there
  }
  return { rest: walk(current, next, []), additions }
}

const BARE = /^[A-Za-z0-9_-]+$/
const keyText = (key: string): string => (BARE.test(key) ? key : JSON.stringify(key))

/** The lines of one table as a section, and under it a section for each table or list of tables it holds. */
function sectionLines(names: readonly string[], value: Table, array: boolean): string[] {
  const here: Table = {}
  const nested: [string, Table, boolean][] = []
  for (const key of keysOf(value)) {
    const item = value[key]
    if (isTable(item)) nested.push([key, item, false])
    else if (isTableList(item)) for (const each of item) nested.push([key, each, true])
    else here[key] = item
  }
  const header = names.map(keyText).join('.')
  const lines = [array ? `[[${header}]]` : `[${header}]`]
  // The files here write `["a"]`, not `[ "a" ]`.
  const body = stringify(here, { bracketSpacing: false }).replace(/\r?\n$/, '')
  if (body !== '') lines.push(...body.split(/\r?\n/))
  for (const [key, item, list] of nested) lines.push('', ...sectionLines([...names, key], item, list))
  return lines
}

/** The names a header spells for a path: an array index is the list's last element, so it is left out. */
const headerNames = (path: KeyPath): string[] => path.filter((key): key is string => typeof key === 'string')

/**
 * `text` with `addition` written as sections, after the last section of the family it joins: those under its parent, or
 * under the nearest parent that has any, or the end of the file.
 */
export function addSection(text: string, addition: Addition): string {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const last = addition.path[addition.path.length - 1]
  const parent = addition.path.slice(0, -1)
  const sections = readSections(text)
  let end = text.trimEnd().length
  for (let length = parent.length; length >= 0; length--) {
    const family = sections.filter((section) =>
      parent.slice(0, length).every((key, index) => section.keyPath[index] === key),
    )
    if (family.length > 0 || length === 0) {
      if (family.length > 0) end = Math.max(...family.map((section) => section.end))
      break
    }
  }
  const names = headerNames(addition.path)
  const items = isTableList(addition.value) ? addition.value : [addition.value as Table]
  const array = typeof last === 'number' || isTableList(addition.value)
  const lines = items.flatMap((item, index) => [
    ...(index > 0 ? [''] : []),
    ...sectionLines(names, item, array),
  ])
  const lead = end === 0 ? '' : `${eol}${eol}`
  // A file with nothing in it gets the line break a file ends with.
  const tail = end === 0 && text === '' ? eol : text.slice(end)
  return `${text.slice(0, end)}${lead}${lines.join(eol)}${tail}`
}
