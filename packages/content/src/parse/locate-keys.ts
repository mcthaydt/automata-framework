// Where each key of a TOML file is, so a diagnostic can say `file:line:col`.
//
// smol-toml returns values only, without source positions. This is a line scanner over text smol-toml has
// already accepted, so it never decides whether the TOML is valid: it only finds where keys start. It
// records:
//   - `key = value` lines (bare, quoted and dotted keys) under the current table;
//   - `[table]` headers, and `[[array]]` headers with each array's running element index;
// and it skips the inside of multi-line strings, multi-line arrays and inline tables, so text that looks like
// a key there is not mistaken for one. Keys inside inline tables and array elements are not indexed;
// `positionOf` falls back to the enclosing key for them.

export interface KeyPosition {
  readonly line: number
  readonly column: number
}

/** Dotted key path (`transitions.1.to`) to the position of its key or header. */
export type KeyIndex = ReadonlyMap<string, KeyPosition>

type Segment = string | number

const joinPath = (path: readonly Segment[]): string => path.map(String).join('.')

const TOP_OF_FILE: KeyPosition = { line: 1, column: 1 }

/** The position of the deepest indexed prefix of `path`, else the top of the file. */
export function positionOf(index: KeyIndex, path: readonly Segment[]): KeyPosition {
  for (let length = path.length; length > 0; length--) {
    const found = index.get(joinPath(path.slice(0, length)))
    if (found !== undefined) return found
  }
  return TOP_OF_FILE
}

/**
 * Reads a dotted key (`a."b c".d`) starting at `start`. Returns its segments and where the key ended, or
 * undefined when the text there is not a key.
 */
function readKey(line: string, start: number): { segments: string[]; end: number } | undefined {
  const segments: string[] = []
  let i = start
  for (;;) {
    while (line[i] === ' ' || line[i] === '\t') i++
    const quote = line[i]
    if (quote === '"' || quote === "'") {
      const close = line.indexOf(quote, i + 1)
      if (close === -1) return undefined
      segments.push(line.slice(i + 1, close))
      i = close + 1
    } else {
      const match = /^[A-Za-z0-9_-]+/.exec(line.slice(i))
      if (match === null) return undefined
      segments.push(match[0])
      i += match[0].length
    }
    while (line[i] === ' ' || line[i] === '\t') i++
    if (line[i] !== '.') return { segments, end: i }
    i++
  }
}

/** What the scanner is inside of when a line ends. */
interface ValueState {
  /** The closing delimiter of an open multi-line string, if any. */
  multiLineString: '"""' | "'''" | undefined
  /** How many `[` / `{` are open in the current value. */
  depth: number
}

/**
 * Scans value text from `start` to the end of the line, updating `state`. Strings are skipped so brackets
 * inside them do not count; a `#` outside a string ends the line.
 */
function scanValue(line: string, start: number, state: ValueState): void {
  let i = start
  while (i < line.length) {
    if (state.multiLineString !== undefined) {
      const close = line.indexOf(state.multiLineString, i)
      if (close === -1) return
      i = close + 3
      state.multiLineString = undefined
      continue
    }
    const char = line[i]
    if (char === '#') return
    if (line.startsWith('"""', i) || line.startsWith("'''", i)) {
      state.multiLineString = line.startsWith('"""', i) ? '"""' : "'''"
      i += 3
      continue
    }
    if (char === '"' || char === "'") {
      // A single-line string: find its end, honoring backslash escapes in basic strings.
      i++
      while (i < line.length && line[i] !== char) i += char === '"' && line[i] === '\\' ? 2 : 1
      i++
      continue
    }
    if (char === '[' || char === '{') state.depth++
    if (char === ']' || char === '}') state.depth--
    i++
  }
}

export function locateKeys(text: string): KeyIndex {
  const index = new Map<string, KeyPosition>()
  const record = (path: readonly Segment[], position: KeyPosition): void => {
    const key = joinPath(path)
    if (!index.has(key)) index.set(key, position)
  }

  // For each array of tables (by its path without indices), the index of its current element.
  const arrayElements = new Map<string, number>()
  // Turns a header's plain segments into a concrete path: every prefix that is an array of tables gets
  // the index of its current element inserted after it, so `[[a.b]]` nests under the current `[[a]]`.
  const concrete = (segments: readonly string[]): Segment[] => {
    const path: Segment[] = []
    for (let i = 0; i < segments.length; i++) {
      path.push(segments[i] as string)
      const element = arrayElements.get(segments.slice(0, i + 1).join('.'))
      if (element !== undefined && i < segments.length - 1) path.push(element)
    }
    return path
  }

  let table: Segment[] = []
  const state: ValueState = { multiLineString: undefined, depth: 0 }
  const lines = text.split(/\r?\n/)

  lines.forEach((line, lineIndex) => {
    // Still inside a value that began on an earlier line.
    if (state.multiLineString !== undefined || state.depth > 0) {
      scanValue(line, 0, state)
      return
    }
    const start = line.search(/\S/)
    if (start === -1 || line[start] === '#') return
    const position = { line: lineIndex + 1, column: start + 1 }

    if (line.startsWith('[[', start)) {
      const key = readKey(line, start + 2)
      if (key === undefined) return
      const name = key.segments.join('.')
      const element = (arrayElements.get(name) ?? -1) + 1
      arrayElements.set(name, element)
      // Elements of a nested array start again under each new parent element.
      for (const other of [...arrayElements.keys()])
        if (other.startsWith(`${name}.`)) arrayElements.delete(other)
      table = [...concrete(key.segments), element]
      record(table.slice(0, -1), position)
      record(table, position)
      return
    }
    if (line[start] === '[') {
      const key = readKey(line, start + 1)
      if (key === undefined) return
      table = concrete(key.segments)
      record(table, position)
      return
    }

    const key = readKey(line, start)
    if (key === undefined || line[key.end] !== '=') return
    record([...table, ...key.segments], position)
    scanValue(line, key.end + 1, state)
  })

  return index
}
