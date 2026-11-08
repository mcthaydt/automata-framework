// The browser-safe JSON scanner: where does each value sit? A server could find spans with TypeScript's JSON parser, but
// an iPad cannot load that, so this reads the text in a single pass. (`level-2d/model/json-syntax.ts` is the other
// scanner on purpose: it only words the first error for the error panel, after `JSON.parse` has thrown, and its
// messages are pinned by that panel's tests. This one builds the tree and refuses a bad text with its own error.)
//
// It accepts exactly what `JSON.parse` accepts (JSON whitespace only, no comments, no trailing commas) and refuses a
// duplicate key in one object, because a path would then name two values. The text is never changed here.

/** Object keys and array indices from the root. */
export type JsonPath = readonly (string | number)[]

/** [start, end) in the text. */
export interface Span {
  readonly start: number
  readonly end: number
}

export type JsonKind = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'

/** One value, with the values inside it. */
export interface JsonNode {
  readonly path: JsonPath
  readonly kind: JsonKind
  /** The value itself: a container's span runs from its opening to its closing bracket. */
  readonly span: Span
  /** The quoted key, when the node is a member of an object. */
  readonly keySpan: Span | undefined
  /** The members of an object or the elements of an array, in document order. */
  readonly children: readonly JsonNode[]
}

/** A string, number, boolean or null, as written. */
export interface JsonLiteral {
  readonly path: JsonPath
  readonly kind: 'string' | 'number' | 'boolean' | 'null'
  readonly span: Span
  /** The literal as written: a string keeps its quotes and escapes, a negative number its minus. */
  readonly text: string
  readonly value: string | number | boolean | null
}

export interface Scan {
  readonly root: JsonNode
  /** The node at a path, or undefined when the text has none. */
  node(path: JsonPath): JsonNode | undefined
  /** Every scalar, in document order. */
  readonly literals: readonly JsonLiteral[]
}

export class JsonScanError extends Error {
  readonly offset: number

  constructor(message: string, offset: number) {
    super(`${message} at ${offset}`)
    this.offset = offset
  }
}

export const pathKey = (path: JsonPath): string => JSON.stringify(path)

const WORDS = [
  ['true', 'boolean', true],
  ['false', 'boolean', false],
  ['null', 'null', null],
] as const

const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y
const isWhitespace = (character: string | undefined) =>
  character === ' ' || character === '\t' || character === '\n' || character === '\r'

/** Reads `text` as JSON and reports where every value sits. Throws `JsonScanError` when `JSON.parse` would throw. */
export function scan(text: string): Scan {
  const nodes = new Map<string, JsonNode>()
  const literals: JsonLiteral[] = []
  let offset = 0

  const fail = (message: string, at = offset): never => {
    throw new JsonScanError(message, Math.min(at, text.length))
  }
  const skipWhitespace = () => {
    while (offset < text.length && isWhitespace(text[offset])) offset++
  }

  /** A string, quotes included. Returns its decoded value; the offset is left after the closing quote. */
  const readString = (): string => {
    const start = offset
    if (text[offset] !== '"') fail('expected a string')
    offset++
    while (offset < text.length && text[offset] !== '"') {
      const code = text.charCodeAt(offset)
      if (code < 0x20) fail('a raw control character in a string')
      offset += text[offset] === '\\' ? 2 : 1
    }
    if (offset >= text.length) fail('unterminated string', start)
    offset++
    try {
      return JSON.parse(text.slice(start, offset)) as string
    } catch {
      return fail('a bad escape in a string', start)
    }
  }

  const literal = (
    path: JsonPath,
    kind: JsonLiteral['kind'],
    start: number,
    value: JsonLiteral['value'],
  ): JsonNode => {
    const span = { start, end: offset }
    literals.push({ path, kind, span, text: text.slice(start, offset), value })
    return { path, kind, span, keySpan: undefined, children: [] }
  }

  const word = (at: number) => WORDS.find(([spelling]) => text.startsWith(spelling, at))

  const readValue = (path: JsonPath, keySpan: Span | undefined): JsonNode => {
    skipWhitespace()
    const start = offset
    const character = text[offset]
    let node: JsonNode
    if (character === '{') node = readObject(path, start)
    else if (character === '[') node = readArray(path, start)
    else if (character === '"') node = literal(path, 'string', start, readString())
    else if (word(offset)) {
      const [spelling, kind, value] = word(offset) as (typeof WORDS)[number]
      offset += spelling.length
      node = literal(path, kind, start, value)
    } else {
      NUMBER.lastIndex = offset
      const match = NUMBER.exec(text)
      if (!match) return fail(character === undefined ? 'unexpected end of text' : 'unexpected token')
      offset += match[0].length
      node = literal(path, 'number', start, Number(match[0]))
    }
    const placed = keySpan ? { ...node, keySpan } : node
    nodes.set(pathKey(path), placed)
    return placed
  }

  const readObject = (path: JsonPath, start: number): JsonNode => {
    const children: JsonNode[] = []
    const seen = new Set<string>()
    offset++
    skipWhitespace()
    if (text[offset] === '}') offset++
    else {
      for (;;) {
        skipWhitespace()
        const keyStart = offset
        const key = readString()
        if (seen.has(key)) fail(`duplicate key ${JSON.stringify(key)}`, keyStart)
        seen.add(key)
        const keySpan = { start: keyStart, end: offset }
        skipWhitespace()
        if (text[offset++] !== ':') fail('expected ":"', offset - 1)
        children.push(readValue([...path, key], keySpan))
        skipWhitespace()
        const separator = text[offset++]
        if (separator === '}') break
        if (separator !== ',') fail('expected "," or "}"', offset - 1)
      }
    }
    return { path, kind: 'object', span: { start, end: offset }, keySpan: undefined, children }
  }

  const readArray = (path: JsonPath, start: number): JsonNode => {
    const children: JsonNode[] = []
    offset++
    skipWhitespace()
    if (text[offset] === ']') offset++
    else {
      for (let index = 0; ; index++) {
        children.push(readValue([...path, index], undefined))
        skipWhitespace()
        const separator = text[offset++]
        if (separator === ']') break
        if (separator !== ',') fail('expected "," or "]"', offset - 1)
      }
    }
    return { path, kind: 'array', span: { start, end: offset }, keySpan: undefined, children }
  }

  const root = readValue([], undefined)
  skipWhitespace()
  if (offset !== text.length) fail('trailing text')
  return { root, node: (path) => nodes.get(pathKey(path)), literals }
}
