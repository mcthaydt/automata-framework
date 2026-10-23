// The block view of a TOML text (EDFF.1a plan, decisions 3 and 6). `@decimalturn/toml-patch` is exact for the changes
// that keep a document's shape, but it handles the comments around an inserted, removed or moved table of an array
// wrongly, so the codec edits those itself: it sees a text as lines, and the lines as tables.
//
// A table's own comments are the contiguous `#` lines directly above its header. What follows its last key line (blank
// lines, and comment blocks that a blank line separates from the next header) is its gap and belongs to nobody, so
// removing a table leaves a floating comment where it was.

export interface TomlLines {
  readonly lines: readonly string[]
  readonly newline: '\n' | '\r\n'
  readonly finalNewline: boolean
}

/** One `[table]` or `[[element]]` of the text; every line number counts from 0. */
export interface Block {
  /** The dotted name, without brackets or spaces: `theme.layers`. */
  readonly name: string
  readonly array: boolean
  readonly header: number
  /** The first of the comment lines directly above the header; the header itself when there are none. */
  readonly start: number
  /** The last line with content: the header, or the last line of its keys and values. */
  readonly last: number
  /** One past the gap: where the next block starts, or the end of the text. */
  readonly end: number
}

export function splitLines(text: string): TomlLines {
  const newline = text.includes('\r\n') ? '\r\n' : '\n'
  const finalNewline = text.endsWith('\n')
  const lines = text.split(/\r?\n/)
  if (finalNewline) lines.pop()
  // An empty text is no lines at all, not one empty line.
  if (text === '') lines.length = 0
  return { lines, newline, finalNewline }
}

export function joinLines(text: TomlLines): string {
  const body = text.lines.join(text.newline)
  return text.finalNewline ? body + text.newline : body
}

const HEADER = /^\s*(\[\[?)\s*([A-Za-z0-9_\-."' ]+?)\s*\]\]?\s*(#.*)?$/
const isComment = (line: string): boolean => line.trimStart().startsWith('#')
export const isBlank = (line: string): boolean => line.trim() === ''

/** `a . "b c"` as `a."b c"`: the parts of a dotted key without the spaces around them. */
function normalizeName(raw: string): string {
  const parts: string[] = []
  let current = ''
  let quote: string | undefined
  for (const char of raw) {
    if (quote !== undefined) {
      current += char
      if (char === quote) quote = undefined
    } else if (char === '"' || char === "'") {
      quote = char
      current += char
    } else if (char === '.') {
      parts.push(current.trim())
      current = ''
    } else current += char
  }
  parts.push(current.trim())
  return parts.join('.')
}

/** How many `"""` or `'''` delimiters a line holds; an odd number opens or closes a multi-line string. */
function delimiters(line: string): { readonly quote: string; readonly count: number } | undefined {
  for (const quote of ['"""', "'''"]) {
    const count = line.split(quote).length - 1
    if (count > 0) return { quote, count }
  }
  return undefined
}

interface Header {
  readonly name: string
  readonly array: boolean
  readonly line: number
}

function findHeaders(lines: readonly string[]): Header[] {
  const headers: Header[] = []
  let openString: string | undefined
  lines.forEach((line, index) => {
    if (openString !== undefined) {
      const found = delimiters(line)
      if (found?.quote === openString && found.count % 2 === 1) openString = undefined
      return
    }
    const found = delimiters(line)
    if (found !== undefined && found.count % 2 === 1) {
      openString = found.quote
      return
    }
    // A comment never matches: it starts with `#`, not `[`.
    const match = HEADER.exec(line)
    if (match?.[1] === undefined || match[2] === undefined) return
    headers.push({ name: normalizeName(match[2]), array: match[1] === '[[', line: index })
  })
  return headers
}

export function scanBlocks(lines: readonly string[]): readonly Block[] {
  const headers = findHeaders(lines)
  const starts = headers.map((header) => {
    let start = header.line
    while (start > 0 && isComment(lines[start - 1] ?? '')) start -= 1
    return start
  })
  return headers.map((header, i) => {
    const end = starts[i + 1] ?? lines.length
    let last = end - 1
    while (last > header.line && (isBlank(lines[last] ?? '') || isComment(lines[last] ?? ''))) last -= 1
    return {
      name: header.name,
      array: header.array,
      header: header.line,
      start: starts[i] ?? header.line,
      last,
      end,
    }
  })
}

/**
 * The line (from 1) of a value in a text, by its path (`['theme', 'layers', 3, 'sink']`). A key that is not there points
 * at the header of the table that should hold it, and a table that is not there at the nearest one that is; a text with
 * no such table at all points at line 1.
 */
export function findLine(
  lines: readonly string[],
  blocks: readonly Block[],
  path: readonly PropertyKey[],
): number {
  // The part of the text before the first table holds the root keys.
  let from = 0
  let to = blocks[0]?.start ?? lines.length
  let header = 0
  let name = ''
  for (const segment of path) {
    if (typeof segment === 'number') {
      const element = blocks.filter((block) => block.name === name)[segment]
      if (element === undefined) return header + 1
      header = element.header
      from = header + 1
      to = element.end
      continue
    }
    const child = name === '' ? String(segment) : `${name}.${String(segment)}`
    const table = blocks.find((block) => block.name === child)
    if (table !== undefined) {
      name = child
      if (!table.array) {
        header = table.header
        from = header + 1
        to = table.end
      }
      continue
    }
    // A table that only has tables below it (`[a.b]` without `[a]`) has no lines of its own.
    if (blocks.some((block) => block.name.startsWith(`${child}.`))) {
      name = child
      continue
    }
    const key = new RegExp(`^\\s*["']?${escapeKey(String(segment))}["']?\\s*=`)
    for (let i = from; i < to; i++) if (key.test(lines[i] ?? '')) return i + 1
    return header + 1
  }
  return header + 1
}

function escapeKey(key: string): string {
  return key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
