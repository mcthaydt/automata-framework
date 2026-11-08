import { parse as parseToml } from '@decimalturn/toml-patch'
import { JsonScanError, scan } from './json/locate'
import { type PatchResult, patchJson } from './json/patch'
import { EXACT_NUMBERS } from './json/print'
import { cloneValue, type KeyPath, keyPathText, valueAt } from './key-path'
import { patchToml } from './toml/patch-toml'
import { readTomlLiterals, TomlPositionError } from './toml/toml-literals'
import { firstDifference, isTable } from './values'

// The content documents every editor writes through: one text, edited by key path, where a
// value edit rewrites only its literal's span and an unchanged document prints byte for byte. Each edit is turned into
// the whole new value and handed to its format's patcher (`patchToml`, `patchJson`), which writes only what differs
// and re-parses its result; a document never holds a text it did not verify. Schema validation is the editor's.

export interface DocumentLiteral {
  readonly keyPath: KeyPath
  /** [start, end) in the text. */
  readonly span: readonly [number, number]
  /** The literal as written. */
  readonly text: string
}

export interface DocumentComments {
  readonly before?: string
  readonly trailing?: string
}

/**
 * A value edit (`expected` is what the document must hold there now), an insert or a remove. An insert's `keyPath`
 * names the new key of a table, or names an array with `at` the new item's index (default: the end).
 */
export type ContentEdit =
  | { readonly keyPath: KeyPath; readonly expected: unknown; readonly set: unknown }
  | { readonly keyPath: KeyPath; readonly insert: unknown; readonly at?: number }
  | { readonly keyPath: KeyPath; readonly remove: true }

export type EditRefusalReason = 'expected-mismatch' | 'unwritable-value' | 'invalid-text' | 'verify-failed'

export type EditResult =
  | {
      readonly ok: true
      readonly document: ContentDocument
      /** In the new text: each edited literal's span, or the region an insert or remove rewrote; merged where they touch. */
      readonly changed: readonly (readonly [number, number])[]
    }
  | {
      readonly ok: false
      readonly keyPath: KeyPath
      readonly reason: EditRefusalReason
      readonly message: string
    }

export interface ContentDocument {
  readonly path: string
  readonly format: 'toml' | 'json'
  readonly text: string
  /** The parsed value (a fresh copy each call). Throws `DocumentSyntaxError` when the text does not parse. */
  value(): unknown
  /** Every scalar's literal, in document order. Throws `DocumentSyntaxError` when the text does not parse. */
  literals(): readonly DocumentLiteral[]
  /** The comments of a key: the whole-line run above it and the one after it on its line (TOML; JSON has none). */
  comments(keyPath: KeyPath): DocumentComments
  /** Applies the edits in order, each to the document the previous one left; all of them, or none. */
  edit(edits: readonly ContentEdit[]): EditResult
}

/** The text does not parse. `line` and `column` are 1-based, when the parser gives a position. */
export class DocumentSyntaxError extends Error {
  readonly line: number | undefined
  readonly column: number | undefined

  constructor(message: string, line?: number, column?: number) {
    super(message)
    this.name = 'DocumentSyntaxError'
    this.line = line
    this.column = column
  }
}

interface Format {
  readonly name: 'toml' | 'json'
  parse(text: string): unknown
  literals(text: string): readonly DocumentLiteral[]
  comments(text: string, keyPath: KeyPath): DocumentComments
  patch(text: string, before: unknown, after: unknown): PatchResult
}

/** toml-patch's message repeats the position, the source line and a caret before the reason; only the reason is kept. */
function tomlSyntaxError(error: unknown): DocumentSyntaxError {
  const { message, line, column } = error as Error & { line?: unknown; column?: unknown }
  const reason = String(message).split('\n').slice(3).join(' ').trim()
  return new DocumentSyntaxError(
    reason === '' ? String(message) : reason,
    typeof line === 'number' ? line : undefined,
    typeof column === 'number' ? column + 1 : undefined,
  )
}

/** Runs a read of a TOML text, turning toml-patch's syntax error into the documents' own. */
function readToml<T>(read: () => T): T {
  try {
    return read()
  } catch (error) {
    if (error instanceof TomlPositionError) throw error
    throw tomlSyntaxError(error)
  }
}

const TOML: Format = {
  name: 'toml',
  parse: (text) => readToml(() => parseToml(text)),
  literals: (text) => readToml(() => readTomlLiterals(text)).literals,
  comments: (text, keyPath) => readToml(() => readTomlLiterals(text)).comments(keyPath),
  patch: patchToml,
}

/**
 * Content JSON has no member order to keep and no ids to align by: positions and keys are the whole story. Numbers
 * round-trip exactly (a content file's numbers never change when saved), unlike the blockout style the 3D level files are written in.
 */
const JSON_RULES = { idArrays: [], memberOrder: () => undefined, numbers: EXACT_NUMBERS }

function jsonScan(text: string): ReturnType<typeof scan> {
  try {
    return scan(text)
  } catch (error) {
    if (!(error instanceof JsonScanError)) throw error
    const before = text.slice(0, error.offset)
    const line = before.split('\n').length
    throw new DocumentSyntaxError(error.message, line, error.offset - before.lastIndexOf('\n'))
  }
}

const JSON_FORMAT: Format = {
  name: 'json',
  parse(text) {
    jsonScan(text)
    return JSON.parse(text)
  },
  literals: (text) =>
    jsonScan(text).literals.map((literal) => ({
      keyPath: literal.path,
      span: [literal.span.start, literal.span.end] as const,
      text: literal.text,
    })),
  comments(text) {
    jsonScan(text)
    return {}
  },
  patch: (text, before, after) => patchJson(text, before, after, JSON_RULES),
}

type Refusal = Extract<EditResult, { ok: false }>

const refuse = (keyPath: KeyPath, reason: EditRefusalReason, message: string): Refusal => ({
  ok: false,
  keyPath,
  reason,
  message,
})

/** The value after one edit, or why the edit cannot be made. `value` is a copy this may change. */
function applyEdit(value: unknown, edit: ContentEdit): { value: unknown } | Refusal {
  const { keyPath } = edit
  const here = valueAt(value, keyPath)
  const parentPath = keyPath.slice(0, -1)
  const parent = valueAt(value, parentPath).value
  const key = keyPath[keyPath.length - 1]
  if ('set' in edit) {
    if (!here.found || firstDifference(here.value, edit.expected) !== undefined)
      return refuse(
        keyPath,
        'expected-mismatch',
        `${keyPathText(keyPath)} does not hold the value the edit expects`,
      )
    if (key === undefined) return { value: cloneValue(edit.set) }
    ;(parent as Record<string | number, unknown>)[key] = cloneValue(edit.set)
    return { value }
  }
  if ('insert' in edit) {
    if (here.found && Array.isArray(here.value)) {
      const at = edit.at ?? here.value.length
      if (!Number.isInteger(at) || at < 0 || at > here.value.length)
        return refuse(keyPath, 'unwritable-value', `${at} is not an index ${keyPathText(keyPath)} can take`)
      here.value.splice(at, 0, cloneValue(edit.insert))
      return { value }
    }
    if (here.found)
      return refuse(
        keyPath,
        'expected-mismatch',
        `${keyPathText(keyPath)} already holds a value; set it instead`,
      )
    if (typeof key !== 'string' || !isTable(parent))
      return refuse(
        keyPath,
        'expected-mismatch',
        `${keyPathText(parentPath)} is not a table to add ${String(key)} to`,
      )
    parent[key] = cloneValue(edit.insert)
    return { value }
  }
  if (!here.found || key === undefined)
    return refuse(keyPath, 'expected-mismatch', `${keyPathText(keyPath)} holds nothing to remove`)
  if (Array.isArray(parent)) parent.splice(key as number, 1)
  else delete (parent as Record<string, unknown>)[key as string]
  return { value }
}

/** Where two texts differ: the common prefix's length, and how long the differing middle is in each. */
function difference(before: string, after: string): { at: number; removed: number; added: number } {
  let at = 0
  while (at < before.length && before[at] === after[at]) at++
  let suffix = 0
  while (
    suffix < before.length - at &&
    suffix < after.length - at &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  )
    suffix++
  return { at, removed: before.length - at - suffix, added: after.length - at - suffix }
}

type Range = readonly [number, number]

/** Moves earlier ranges through a later rewrite of `[at, at + removed)` into `added` characters. */
function carry(ranges: readonly Range[], change: { at: number; removed: number; added: number }): Range[] {
  const { at, removed, added } = change
  const shift = added - removed
  return ranges.map(([start, end]): Range => {
    if (end <= at) return [start, end]
    if (start >= at + removed) return [start + shift, end + shift]
    return [Math.min(start, at), Math.max(end + shift, at + added)]
  })
}

/** Sorted, with touching or overlapping ranges merged. */
function merged(ranges: readonly Range[]): Range[] {
  const out: [number, number][] = []
  for (const [start, end] of [...ranges].sort((a, b) => a[0] - b[0])) {
    const last = out[out.length - 1]
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else out.push([start, end])
  }
  return out
}

function createDocument(path: string, format: Format, text: string): ContentDocument {
  let parsed: { value: unknown } | undefined
  const read = (): unknown => {
    parsed ??= { value: format.parse(text) }
    return parsed.value
  }
  const document: ContentDocument = {
    path,
    format: format.name,
    text,
    value: () => cloneValue(read()),
    literals: () => format.literals(text),
    comments: (keyPath) => format.comments(text, keyPath),
    edit(edits) {
      let value: unknown
      try {
        value = read()
      } catch (error) {
        if (error instanceof DocumentSyntaxError) return refuse([], 'invalid-text', error.message)
        throw error
      }
      let current = text
      let ranges: Range[] = []
      for (const edit of edits) {
        const next = applyEdit(cloneValue(value), edit)
        if ('ok' in next) return next
        const result = format.patch(current, value, next.value)
        if (!result.ok) {
          const reason = result.reason === 'before-mismatch' ? 'verify-failed' : result.reason
          return refuse(result.path.length > 0 ? result.path : edit.keyPath, reason, result.detail)
        }
        const change = difference(current, result.text)
        ranges = carry(ranges, change)
        if (change.removed > 0 || change.added > 0) {
          // A value edit reports its literal's whole new span; anything else, the region the text changed in.
          const literal =
            'set' in edit
              ? format
                  .literals(result.text)
                  .find((each) => keyPathText(each.keyPath) === keyPathText(edit.keyPath))
              : undefined
          ranges.push(literal ? literal.span : [change.at, change.at + change.added])
        }
        current = result.text
        // The next edit starts from what the text now reads, not from the value asked for: the two can differ where
        // the writer spells a value its own way, and the next patch checks its starting value against the text.
        value = format.parse(current)
      }
      return { ok: true, document: createDocument(path, format, current), changed: merged(ranges) }
    },
  }
  return document
}

/** The document of `text`, its format from the path's extension (`.toml` or `.json`). A text that does not parse still opens. */
export function openDocument(path: string, text: string): ContentDocument {
  const extension = path.slice(path.lastIndexOf('.')).toLowerCase()
  if (extension === '.toml') return createDocument(path, TOML, text)
  if (extension === '.json') return createDocument(path, JSON_FORMAT, text)
  throw new Error(`${path}: a content document is .toml or .json`)
}
