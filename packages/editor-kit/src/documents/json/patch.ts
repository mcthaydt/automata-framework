// The diff of ED3D spec §4.5: turns "this text, and the model it parses to, is now that model" into the edits the
// change needs and nothing more, applied through the structure edits so every unchanged byte stays where it is.
// Last Light has no equivalent: its editor edits spans live, one command at a time, while this one diffs whole models
// because the kit's History keeps snapshots (ED3D-D4). The layout rules for what an insert looks like are Last
// Light's (structure.ts).
import { type JsonPath, JsonScanError, scan } from './locate'
import { BLOCKOUT_NUMBERS, JsonWriteError, type NumberStyle } from './print'
import {
  insertElement,
  insertMember,
  JsonShapeError,
  type JsonValue,
  removeElement,
  removeMember,
  replaceValue,
} from './structure'

export interface PatchRules {
  /** Array keys whose elements are objects matched by their `id` (a new id inserts, a missing id removes). */
  readonly idArrays: readonly string[]
  /** The order a schema gives the members of the object at a path, so a new member lands where it belongs. */
  readonly memberOrder: (path: JsonPath) => readonly string[] | undefined
  /** How numbers are written and read back; the blockout style (four decimals, no exponent) when left out. */
  readonly numbers?: NumberStyle
}

export type PatchRefusalReason = 'unwritable-value' | 'invalid-text' | 'before-mismatch' | 'verify-failed'

export type PatchResult =
  | { readonly ok: true; readonly text: string }
  | {
      readonly ok: false
      readonly path: JsonPath
      readonly reason: PatchRefusalReason
      readonly detail: string
    }

type Json = JsonValue | undefined

const isObject = (value: unknown): value is Record<string, Json> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** The keys of an object that hold a value: a member set to `undefined` is no member (as in `JSON.stringify`). */
const keysOf = (object: Record<string, Json>): string[] =>
  Object.keys(object).filter((key) => object[key] !== undefined)

/** Deep equality of two JSON values, key order aside. Numbers compare exactly. */
function equal(a: Json, b: Json): boolean {
  if (a === b) return true
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, i) => equal(item, b[i]))
    )
  }
  if (isObject(a) && isObject(b)) {
    const keys = keysOf(a)
    return (
      keys.length === keysOf(b).length && keys.every((key) => b[key] !== undefined && equal(a[key], b[key]))
    )
  }
  return false
}

/**
 * Where the new value writes differently from the old text: a number whose rounded print equals what the file already
 * has is not an edit, so a file keeps `4.90` when the model says `4.9000000001`.
 */
function sameOnDisk(old: Json, next: Json, numbers: NumberStyle): boolean {
  return (
    equal(old, next) || (typeof old === 'number' && typeof next === 'number' && numbers.round(next) === old)
  )
}

/**
 * A step on the way to the new text. They are applied one at a time, and each index is the index in the text as it
 * stands when the step runs, which is why `diff` emits the steps of one container from its last element to its first.
 */
type Step =
  | { readonly kind: 'replace'; readonly path: JsonPath; readonly value: JsonValue }
  | {
      readonly kind: 'insert-element'
      readonly path: JsonPath
      readonly index: number
      readonly value: JsonValue
    }
  | { readonly kind: 'remove-element'; readonly path: JsonPath; readonly index: number }
  | {
      readonly kind: 'insert-member'
      readonly path: JsonPath
      readonly key: string
      readonly value: JsonValue
      readonly order: readonly string[] | undefined
    }
  | { readonly kind: 'remove-member'; readonly path: JsonPath; readonly key: string }

const hasId = (value: Json): boolean => isObject(value) && typeof value.id === 'string'

/** Aligns two id arrays when every element has a unique id and the ids both arrays share are in the same order. */
function alignById(old: Json[], next: Json[]): { oldIndex: number; newIndex: number }[] | undefined {
  if (!old.every(hasId) || !next.every(hasId)) return undefined
  const oldIds = old.map((item) => (item as { id: string }).id)
  const newIds = next.map((item) => (item as { id: string }).id)
  if (new Set(oldIds).size !== oldIds.length || new Set(newIds).size !== newIds.length) return undefined
  const pairs: { oldIndex: number; newIndex: number }[] = []
  let lastOld = -1
  for (const [newIndex, id] of newIds.entries()) {
    const oldIndex = oldIds.indexOf(id)
    if (oldIndex < 0) continue
    if (oldIndex < lastOld) return undefined
    lastOld = oldIndex
    pairs.push({ oldIndex, newIndex })
  }
  return pairs
}

function diffIdArray(
  path: JsonPath,
  old: Json[],
  next: Json[],
  pairs: { oldIndex: number; newIndex: number }[],
  steps: Step[],
  rules: PatchRules,
): void {
  // Walk the gaps between kept elements from the last to the first; inside a gap, insert (at the index of the kept
  // element that follows it) before removing, so the removals' indices stay as they were.
  let oldEnd = old.length
  let newEnd = next.length
  for (let at = pairs.length; at >= 0; at--) {
    const pair = pairs[at - 1]
    const oldStart = pair ? pair.oldIndex + 1 : 0
    const newStart = pair ? pair.newIndex + 1 : 0
    for (let n = newEnd - 1; n >= newStart; n--) {
      steps.push({ kind: 'insert-element', path, index: oldEnd, value: next[n] as JsonValue })
    }
    for (let o = oldEnd - 1; o >= oldStart; o--) steps.push({ kind: 'remove-element', path, index: o })
    if (!pair) break
    diff([...path, pair.oldIndex], old[pair.oldIndex], next[pair.newIndex], steps, rules)
    oldEnd = pair.oldIndex
    newEnd = pair.newIndex
  }
}

function diffPositionalArray(
  path: JsonPath,
  old: Json[],
  next: Json[],
  steps: Step[],
  rules: PatchRules,
): void {
  let prefix = 0
  while (prefix < old.length && prefix < next.length && equal(old[prefix], next[prefix])) prefix++
  let suffix = 0
  while (
    suffix < old.length - prefix &&
    suffix < next.length - prefix &&
    equal(old[old.length - 1 - suffix], next[next.length - 1 - suffix])
  )
    suffix++
  const oldMiddle = old.length - suffix - prefix
  const newMiddle = next.length - suffix - prefix
  const paired = Math.min(oldMiddle, newMiddle)
  // Extras first, at indices past every pair, then the pairs from the last to the first.
  for (let n = prefix + newMiddle - 1; n >= prefix + paired; n--) {
    steps.push({ kind: 'insert-element', path, index: prefix + paired, value: next[n] as JsonValue })
  }
  for (let o = prefix + oldMiddle - 1; o >= prefix + paired; o--)
    steps.push({ kind: 'remove-element', path, index: o })
  for (let i = prefix + paired - 1; i >= prefix; i--) diff([...path, i], old[i], next[i], steps, rules)
}

function diffObject(
  path: JsonPath,
  old: Record<string, Json>,
  next: Record<string, Json>,
  steps: Step[],
  rules: PatchRules,
): void {
  const oldKeys = keysOf(old)
  const newKeys = keysOf(next)
  for (const key of newKeys) {
    if (old[key] !== undefined) diff([...path, key], old[key], next[key], steps, rules)
  }
  const order = rules.memberOrder(path)
  for (const key of newKeys) {
    if (old[key] === undefined) {
      steps.push({ kind: 'insert-member', path, key, value: next[key] as JsonValue, order })
    }
  }
  for (const key of oldKeys) {
    if (next[key] === undefined) steps.push({ kind: 'remove-member', path, key })
  }
}

/** The steps that turn `old` into `next` at `path`: nothing when they are the same, a replacement when a scalar or a kind changes. */
function diff(path: JsonPath, old: Json, next: Json, steps: Step[], rules: PatchRules): void {
  if (sameOnDisk(old, next, rules.numbers ?? BLOCKOUT_NUMBERS)) return
  if (Array.isArray(old) && Array.isArray(next)) {
    const key = path[path.length - 1]
    const pairs = typeof key === 'string' && rules.idArrays.includes(key) ? alignById(old, next) : undefined
    if (pairs) diffIdArray(path, old, next, pairs, steps, rules)
    else diffPositionalArray(path, old, next, steps, rules)
  } else if (isObject(old) && isObject(next)) diffObject(path, old, next, steps, rules)
  else steps.push({ kind: 'replace', path, value: next as JsonValue })
}

function apply(text: string, step: Step, numbers: NumberStyle): string {
  switch (step.kind) {
    case 'replace':
      return replaceValue(text, step.path, step.value, numbers)
    case 'insert-element':
      return insertElement(text, step.path, step.value, step.index, numbers)
    case 'remove-element':
      return removeElement(text, step.path, step.index)
    case 'insert-member': {
      const at = step.order?.indexOf(step.key) ?? -1
      const placement =
        step.order && at >= 0 ? { before: step.order.slice(at + 1), after: step.order.slice(0, at) } : {}
      return insertMember(text, step.path, step.key, step.value, placement, numbers)
    }
    case 'remove-member':
      return removeMember(text, step.path, step.key)
  }
}

const refuse = (path: JsonPath, reason: PatchRefusalReason, detail: string): PatchResult => ({
  ok: false,
  path,
  reason,
  detail,
})

/**
 * The first path, in document order, where `actual` and `expected` differ, or undefined when they are the same value
 * (key order aside). With `rounded` (a number style), a number matches when it is the expected one or the expected one as the file
 * writes it.
 */
function firstDifference(
  actual: Json,
  expected: Json,
  rounded: NumberStyle | undefined,
  path: JsonPath = [],
): JsonPath | undefined {
  if (typeof actual === 'number' && typeof expected === 'number') {
    return actual === expected || (rounded !== undefined && actual === rounded.round(expected))
      ? undefined
      : path
  }
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) return path
    for (const [i, item] of actual.entries()) {
      const found = firstDifference(item, expected[i], rounded, [...path, i])
      if (found) return found
    }
    return undefined
  }
  if (isObject(actual) && isObject(expected)) {
    const keys = keysOf(actual)
    const stray = [...keys, ...keysOf(expected)].find(
      (key) => (actual[key] === undefined) !== (expected[key] === undefined),
    )
    if (stray !== undefined) return [...path, stray]
    for (const key of keys) {
      const found = firstDifference(actual[key], expected[key], rounded, [...path, key])
      if (found) return found
    }
    return undefined
  }
  return actual === expected ? undefined : path
}

/** The first value in `after` that cannot be written as JSON the way these files write it, with why. */
function firstUnwritable(
  value: Json,
  numbers: NumberStyle,
  path: JsonPath = [],
): { path: JsonPath; detail: string } | undefined {
  if (typeof value === 'number') {
    try {
      numbers.format(value)
    } catch (error) {
      if (error instanceof JsonWriteError) return { path, detail: error.message }
      throw error
    }
    return undefined
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return undefined
  if (Array.isArray(value)) {
    for (const [i, item] of value.entries()) {
      const found = firstUnwritable(item, numbers, [...path, i])
      if (found) return found
    }
    return undefined
  }
  if (isObject(value)) {
    for (const key of keysOf(value)) {
      const found = firstUnwritable(value[key], numbers, [...path, key])
      if (found) return found
    }
    return undefined
  }
  return { path, detail: `${typeof value} is not a JSON value` }
}

/**
 * Checks that `text` reads as `after` (numbers as the file writes them). This is the guard against a bug in the diff:
 * `patchJson` runs it on every result, and a result that fails it is never returned.
 */
export function verifyPatched(
  text: string,
  after: unknown,
  numbers: NumberStyle = BLOCKOUT_NUMBERS,
): PatchResult {
  let parsed: Json
  try {
    parsed = JSON.parse(text) as Json
  } catch (error) {
    return refuse([], 'verify-failed', `the patched text is not JSON: ${(error as Error).message}`)
  }
  const path = firstDifference(parsed, after as Json, numbers)
  return path
    ? refuse(
        path,
        'verify-failed',
        `the patched text does not read as the new model at ${JSON.stringify(path)}`,
      )
    : { ok: true, text }
}

/**
 * Turns `text` into the text of `after`, given `before`, the model `text` parses to. Only what differs between the two
 * models is written; every other byte of the file stays. Numbers are written in `rules.numbers`' style: by default with
 * at most 4 decimals (`print.ts`), so the saved file can differ from `after` by less than 0.00005; with
 * `EXACT_NUMBERS`, exactly. A refusal carries a path and a reason and no text; what
 * each reason means is in spec §4.5.
 */
export function patchJson(text: string, before: unknown, after: unknown, rules: PatchRules): PatchResult {
  try {
    scan(text)
  } catch (error) {
    if (error instanceof JsonScanError) return refuse([], 'invalid-text', error.message)
    throw error
  }
  const numbers = rules.numbers ?? BLOCKOUT_NUMBERS
  const mismatch = firstDifference(JSON.parse(text) as Json, before as Json, undefined)
  if (mismatch) {
    return refuse(
      mismatch,
      'before-mismatch',
      `the model the patch starts from differs from the text at ${JSON.stringify(mismatch)}`,
    )
  }
  const unwritable = firstUnwritable(after as Json, numbers)
  if (unwritable) return refuse(unwritable.path, 'unwritable-value', unwritable.detail)

  const steps: Step[] = []
  diff([], before as Json, after as Json, steps, rules)
  let out = text
  try {
    for (const step of steps) out = apply(out, step, numbers)
  } catch (error) {
    // A structure edit checks its own result, so reaching here means the diff asked for something it cannot do.
    if (error instanceof JsonShapeError) return refuse(error.path, 'verify-failed', error.message)
    throw error
  }
  return verifyPatched(out, after, numbers)
}
