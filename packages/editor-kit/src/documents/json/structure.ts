// Extracted from The Last Light editor/src/server/json-structure.ts (92e6704), on the span scanner instead of
// TypeScript's JSON parser: insert or remove one array element or object member, or replace one value, by its exact
// span, in a hand-formatted JSON file. Nothing else is re-printed. A new value is written the way its neighbours
// are: inline when the sibling it copies is on one line, one member per line (or several, when the sibling packs
// them) when it isn't, with the sibling's indentation and brace spacing. Each result is checked with JSON.parse:
// the edited path must read the intended value.
import { indentAt, type Layout, lineStart, PACK_WIDTH, readLayout, sameLine } from './layout'
import { type JsonNode, type JsonPath, JsonScanError, type Scan, scan } from './locate'
import { formatJsonScalar, roundJsonNumber } from './print'

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

/** The edit cannot be made: a path that is not there, a container of the wrong kind, a duplicate member. */
export class JsonShapeError extends Error {
  readonly path: JsonPath

  constructor(message: string, path: JsonPath = []) {
    super(message)
    this.path = path
  }
}

export interface MemberPlacement {
  /** Insert before the first existing member named here (in that order of preference). */
  readonly before?: readonly string[]
  /** Otherwise after the last existing member named here. */
  readonly after?: readonly string[]
  /** A member elsewhere whose value is the layout template (otherwise a sibling's value of the same kind). */
  readonly like?: JsonPath
}

interface Source {
  readonly text: string
  readonly scanned: Scan
  readonly layout: Layout
}

function read(text: string): Source {
  try {
    return { text, scanned: scan(text), layout: readLayout(text) }
  } catch (error) {
    if (error instanceof JsonScanError) throw new JsonShapeError(`not valid JSON: ${error.message}`)
    throw error
  }
}

/** The node at `path`, or the shortest prefix of it that does not exist. */
function nodeAt(source: Source, path: JsonPath): JsonNode {
  for (let length = 0; length <= path.length; length++) {
    if (!source.scanned.node(path.slice(0, length))) {
      throw new JsonShapeError(`${JSON.stringify(path.slice(0, length))} does not exist`, path)
    }
  }
  return source.scanned.node(path) as JsonNode
}

const child = (node: JsonNode, index: number): JsonNode => {
  const found = node.children[index]
  if (!found) throw new JsonShapeError(`${JSON.stringify([...node.path, index])} does not exist`, node.path)
  return found
}

/** A member runs from its key; an element is just its value. */
const itemStart = (node: JsonNode): number => node.keySpan?.start ?? node.span.start
const itemEnd = (node: JsonNode): number => node.span.end
const memberName = (node: JsonNode): string => String(node.path[node.path.length - 1])
const isMultiline = (source: Source, node: JsonNode): boolean =>
  source.text.slice(node.span.start, node.span.end).includes('\n')

const valueAt = (model: unknown, path: JsonPath): unknown =>
  path.reduce<unknown>(
    (at, key) =>
      at !== null && typeof at === 'object' ? (at as Record<string | number, unknown>)[key] : undefined,
    model,
  )
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** A value as the file will read it back: every number rounded the way `print.ts` writes it. */
function asWritten(value: unknown): unknown {
  if (typeof value === 'number') return Number.isFinite(value) ? roundJsonNumber(value) : value
  if (Array.isArray(value)) return value.map(asWritten)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, asWritten(item)]))
  }
  return value
}

function check(out: string, path: JsonPath, want: unknown, what: string): string {
  let model: unknown
  try {
    model = JSON.parse(out)
  } catch (error) {
    throw new JsonShapeError(`${what} would leave the file invalid: ${(error as Error).message}`, path)
  }
  if (want !== undefined && !same(valueAt(model, path), want)) {
    throw new JsonShapeError(`${what}: ${JSON.stringify(path)} does not read as intended afterwards`, path)
  }
  return out
}

const splice = (text: string, start: number, end: number, insert: string) =>
  text.slice(0, start) + insert + text.slice(end)

// ── Writing a value like its neighbours ──

function inline(value: JsonValue, bracesSpaced: boolean): string {
  if (Array.isArray(value)) return `[${value.map((item) => inline(item, bracesSpaced)).join(', ')}]`
  if (value !== null && typeof value === 'object') {
    const body = Object.entries(value)
      .map(([key, item]) => `${JSON.stringify(key)}: ${inline(item, bracesSpaced)}`)
      .join(', ')
    if (!body) return '{}'
    return bracesSpaced ? `{ ${body} }` : `{${body}}`
  }
  return formatJsonScalar(value)
}

function expanded(value: JsonValue, indent: string, unit: string): string {
  const inner = indent + unit
  if (Array.isArray(value)) {
    if (!value.length) return '[]'
    return `[\n${value.map((item) => inner + expanded(item, inner, unit)).join(',\n')}\n${indent}]`
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
    if (!entries.length) return '{}'
    const lines = entries.map(
      ([key, item]) => `${inner}${JSON.stringify(key)}: ${expanded(item, inner, unit)}`,
    )
    return `{\n${lines.join(',\n')}\n${indent}}`
  }
  return formatJsonScalar(value)
}

/** Lines of items: each multi-line item alone; single-line ones packed up to PACK_WIDTH when `packed`, else one per line. */
function lines(items: string[], indent: string, packed: boolean): string {
  const out: string[] = []
  let current = ''
  for (const item of items) {
    if (!packed || item.includes('\n')) {
      if (current) out.push(current)
      current = ''
      out.push(indent + item)
      continue
    }
    if (current && current.length + 2 + item.length > PACK_WIDTH) {
      out.push(current)
      current = ''
    }
    current = current ? `${current}, ${item}` : indent + item
  }
  if (current) out.push(current)
  return out.join(',\n')
}

/**
 * `value` written like `template` (a node of the file of the same kind): inline if the template is one line, else laid
 * out member by member the way the template is, each member like the template's member of the same name (an array
 * element like the template's element at that index, or its last). With no template, the file's default.
 */
function render(source: Source, value: JsonValue, template: JsonNode | undefined, indent: string): string {
  const { text, layout } = source
  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value)
  const isArray = Array.isArray(value)
  if (!isObject && !isArray) return formatJsonScalar(value)
  if (!template || template.kind !== (isObject ? 'object' : 'array')) {
    return layout.expandsEverything
      ? expanded(value, indent, layout.unit)
      : inline(value, layout.bracesSpaced)
  }
  if (!isMultiline(source, template)) {
    const written = text.slice(template.span.start, template.span.end)
    const spaced = /\{ "/.test(written) ? true : /\{"/.test(written) ? false : layout.bracesSpaced
    return inline(value, spaced)
  }
  const closeIndent = indentAt(text, template.span.end - 1)
  const members = template.children
  const first = members[0]
  const inner = first ? indentAt(text, itemStart(first)) : closeIndent + layout.unit
  const packed = members.some(
    (member, i) => i > 0 && sameLine(text, itemEnd(child(template, i - 1)), itemStart(member)),
  )
  if (isObject) {
    const byName = new Map(members.map((member) => [memberName(member), member]))
    const entries = Object.entries(value as Record<string, JsonValue>)
    if (!entries.length) return '{}'
    const items = entries.map(
      ([key, item]) => `${JSON.stringify(key)}: ${render(source, item, byName.get(key), inner)}`,
    )
    return `{\n${lines(items, inner, packed)}\n${indent}}`
  }
  const elements = value as JsonValue[]
  if (!elements.length) return '[]'
  const items = elements.map((item, i) =>
    render(source, item, members[Math.min(i, members.length - 1)], inner),
  )
  return `[\n${lines(items, inner, packed)}\n${indent}]`
}

// ── Where a new item goes ──

/** The separator between two items of a container, comma included, as the container writes it. */
function separator(source: Source, container: JsonNode): string {
  const { text } = source
  const first = child(container, 0)
  if (container.children.length >= 2) return text.slice(itemEnd(first), itemStart(child(container, 1)))
  return text.slice(container.span.start + 1, itemStart(first)).includes('\n')
    ? `,\n${indentAt(text, itemStart(first))}`
    : ', '
}

/**
 * Insert `item` as the `at`th of a container's items (`at` = length appends). Before the first item it takes the
 * container's separator after it; after an item it goes on that item's line when the container packs several items
 * to a line and it fits in PACK_WIDTH, else on a line of its own at that item's indentation.
 */
function place(source: Source, container: JsonNode, at: number, item: string): string {
  const { text, layout } = source
  const items = container.children
  const open = container.span.start
  const general = separator(source, container)
  if (at === 0)
    return splice(text, itemStart(child(container, 0)), itemStart(child(container, 0)), item + general)
  const previous = child(container, at - 1)
  const packed = items.some(
    (candidate, i) => i > 0 && sameLine(text, itemEnd(child(container, i - 1)), itemStart(candidate)),
  )
  // A line of its own at the item's indentation, or one deeper when the container opens on that same line.
  const own = `,\n${indentAt(text, itemStart(previous))}${sameLine(text, open, itemStart(previous)) ? layout.unit : ''}`
  let sep = items.length === 1 ? general : own
  if (packed && !item.includes('\n')) {
    const column = itemEnd(previous) - lineStart(text, itemEnd(previous))
    const rest = /^[^\n]*/.exec(text.slice(itemEnd(previous)))?.[0] ?? ''
    sep = column + 2 + item.length + rest.length <= PACK_WIDTH ? ', ' : own
  } else if (item.includes('\n') && !sep.includes('\n')) sep = own
  return splice(text, itemEnd(previous), itemEnd(previous), sep + item)
}

/** A new item into an empty container: `[x]` / `{ "k": x }` inline, or on its own line in the file's expanded style. */
function intoEmpty(source: Source, container: JsonNode, item: string, close: ']' | '}'): string {
  const { text, layout } = source
  const start = container.span.start
  const indent = indentAt(text, start)
  const open = close === ']' ? '[' : '{'
  const body =
    layout.expandsEverything || item.includes('\n')
      ? `${open}\n${indent}${layout.unit}${item}\n${indent}${close}`
      : open === '{' && layout.bracesSpaced
        ? `{ ${item} }`
        : `${open}${item}${close}`
  return splice(text, start, container.span.end, body)
}

// ── The operations ──

/** Insert `value` into the array at `path`, at `index` (default: the end). */
export function insertElement(text: string, path: JsonPath, value: JsonValue, index?: number): string {
  const source = read(text)
  const container = nodeAt(source, path)
  if (container.kind !== 'array') throw new JsonShapeError(`${JSON.stringify(path)} is not an array`, path)
  const count = container.children.length
  const at = index ?? count
  if (at < 0 || at > count) {
    throw new JsonShapeError(`index ${at} is outside ${JSON.stringify(path)} (${count} elements)`, path)
  }
  let out: string
  if (!count) {
    const indent = indentAt(text, container.span.start) + source.layout.unit
    out = intoEmpty(source, container, render(source, value, undefined, indent), ']')
  } else {
    const template = child(container, Math.max(0, at - 1))
    const indent = indentAt(text, itemStart(template))
    out = place(source, container, at, render(source, value, template, indent))
  }
  return check(out, [...path, at], asWritten(value), 'the insert')
}

/** Remove the element at `index` of the array at `path`, with its separator. */
export function removeElement(text: string, path: JsonPath, index: number): string {
  const source = read(text)
  const container = nodeAt(source, path)
  if (container.kind !== 'array') throw new JsonShapeError(`${JSON.stringify(path)} is not an array`, path)
  const items = container.children
  if (!(index >= 0 && index < items.length))
    throw new JsonShapeError(`${JSON.stringify([...path, index])} does not exist`, path)
  const want = (valueAt(JSON.parse(text), path) as unknown[]).filter((_, i) => i !== index)
  let out: string
  if (items.length === 1) out = splice(text, container.span.start, container.span.end, '[]')
  else if (index === 0) out = splice(text, itemStart(child(container, 0)), itemStart(child(container, 1)), '')
  else out = splice(text, itemEnd(child(container, index - 1)), itemEnd(child(container, index)), '')
  return check(out, path, want, 'the removal')
}

/**
 * Add the member `key` to the object at `path`: before the first existing member named in `before` (in that
 * order of preference), else after the last member named in `after`, else at the end. Refused if it exists.
 */
export function insertMember(
  text: string,
  path: JsonPath,
  key: string,
  value: JsonValue,
  placement: MemberPlacement = {},
): string {
  const source = read(text)
  const container = nodeAt(source, path)
  if (container.kind !== 'object') throw new JsonShapeError(`${JSON.stringify(path)} is not an object`, path)
  const members = container.children
  if (members.some((member) => memberName(member) === key)) {
    throw new JsonShapeError(`${JSON.stringify(path)} already has ${JSON.stringify(key)}`, path)
  }
  const kindOf = (node: JsonNode) => (node.kind === 'array' || node.kind === 'object' ? node.kind : 'scalar')
  const want = Array.isArray(value)
    ? 'array'
    : value !== null && typeof value === 'object'
      ? 'object'
      : 'scalar'
  const like = placement.like ? source.scanned.node(placement.like) : undefined
  const template = like ?? [...members].reverse().find((member) => kindOf(member) === want)
  if (!members.length) {
    const indent = indentAt(text, container.span.start) + source.layout.unit
    const item = `${JSON.stringify(key)}: ${render(source, value, template, indent)}`
    return check(intoEmpty(source, container, item, '}'), [...path, key], asWritten(value), 'the insert')
  }
  const names = members.map(memberName)
  let at = members.length
  const before = (placement.before ?? []).map((name) => names.indexOf(name)).filter((i) => i >= 0)
  const after = (placement.after ?? []).map((name) => names.indexOf(name)).filter((i) => i >= 0)
  if (before.length) at = Math.min(...before)
  else if (after.length) at = Math.max(...after) + 1
  const neighbour = child(container, Math.max(0, at - 1))
  const indent = indentAt(text, itemStart(neighbour))
  const out = place(
    source,
    container,
    at,
    `${JSON.stringify(key)}: ${render(source, value, template, indent)}`,
  )
  return check(out, [...path, key], asWritten(value), 'the insert')
}

/** Remove the member `key` of the object at `path`, with its separator. */
export function removeMember(text: string, path: JsonPath, key: string): string {
  const source = read(text)
  const container = nodeAt(source, path)
  if (container.kind !== 'object') throw new JsonShapeError(`${JSON.stringify(path)} is not an object`, path)
  const members = container.children
  const index = members.findIndex((member) => memberName(member) === key)
  if (index < 0) throw new JsonShapeError(`${JSON.stringify([...path, key])} does not exist`, path)
  let out: string
  if (members.length === 1) out = splice(text, container.span.start, container.span.end, '{}')
  else if (index === 0) out = splice(text, itemStart(child(container, 0)), itemStart(child(container, 1)), '')
  else out = splice(text, itemEnd(child(container, index - 1)), itemEnd(child(container, index)), '')
  if (valueAt(JSON.parse(out), [...path, key]) !== undefined)
    throw new JsonShapeError('the removal did not take', path)
  return check(out, path, undefined, 'the removal')
}

/** Replace the value at `path`, written like the value it replaces. */
export function replaceValue(text: string, path: JsonPath, value: JsonValue): string {
  const source = read(text)
  const node = nodeAt(source, path)
  const indent = indentAt(text, node.span.start)
  const out = splice(text, node.span.start, node.span.end, render(source, value, node, indent))
  return check(out, path, asWritten(value), 'the replacement')
}

/** Set a member: replace it if it exists, else insert it (see insertMember). */
export function setMember(
  text: string,
  path: JsonPath,
  key: string,
  value: JsonValue,
  placement: MemberPlacement = {},
): string {
  const at = valueAt(JSON.parse(text), path)
  if (at === null || typeof at !== 'object' || Array.isArray(at)) {
    throw new JsonShapeError(`${JSON.stringify(path)} is not an object`, path)
  }
  return key in at
    ? replaceValue(text, [...path, key], value)
    : insertMember(text, path, key, value, placement)
}
