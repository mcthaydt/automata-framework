import { parse, patch } from '@decimalturn/toml-patch'
import type { PatchResult } from '../json/patch'
import { type KeyPath, keyPathText } from '../key-path'
import { firstDifference, firstUnwritable, isTable, keysOf, sameValue } from '../values'
import { readTomlLiterals, TomlPositionError } from './toml-literals'
import { type TomlScalar, writeTomlScalar } from './toml-scalar'
import { addSection, splitAdditions } from './toml-sections'

// The TOML half of the content documents. A scalar whose literal is in the text
// is written into that literal's span and nowhere else, as the shortest text that reads back as exactly it; only what is left (a key or array
// item added or removed, a value changing kind) goes to toml-patch, which keeps comments, blank lines and line endings.
// Every result is parsed again and compared with the value asked for, and one that does not read as it is refused.

const refuse = (
  path: KeyPath,
  reason: 'invalid-text' | 'before-mismatch' | 'unwritable-value' | 'verify-failed',
  detail: string,
): PatchResult => ({
  ok: false,
  path,
  reason,
  detail,
})

const isScalar = (value: unknown): value is TomlScalar =>
  ['string', 'number', 'bigint', 'boolean'].includes(typeof value)

interface Splice {
  readonly span: readonly [number, number]
  readonly text: string
}

/** The span edits that turn the scalars of `old` into those of `next`, where both are scalars the text writes. */
function scalarSplices(
  old: unknown,
  next: unknown,
  path: KeyPath,
  literals: ReadonlyMap<string, { span: readonly [number, number]; text: string }>,
  out: Splice[],
): void {
  if (sameValue(old, next)) return
  if (isScalar(old) && isScalar(next)) {
    const literal = literals.get(keyPathText(path))
    if (literal) out.push({ span: literal.span, text: writeTomlScalar(next, literal.text) })
  } else if (Array.isArray(old) && Array.isArray(next) && old.length === next.length) {
    for (const [index, item] of next.entries())
      scalarSplices(old[index], item, [...path, index], literals, out)
  } else if (isTable(old) && isTable(next)) {
    for (const key of keysOf(next))
      if (old[key] !== undefined) scalarSplices(old[key], next[key], [...path, key], literals, out)
  }
}

/** What toml-patch is given: `next`, except where the text already writes it (kept as the text reads, so toml-patch leaves it alone). */
function reconcile(current: unknown, next: unknown): unknown {
  if (sameValue(current, next)) return current
  if (Array.isArray(next))
    return next.map((item, index) => reconcile(Array.isArray(current) ? current[index] : undefined, item))
  if (isTable(next)) {
    const table: Record<string, unknown> = {}
    for (const key of keysOf(next))
      table[key] = reconcile(isTable(current) ? current[key] : undefined, next[key])
    return table
  }
  return next
}

/**
 * The text of `after`, given the `text` that reads as `current`: a table that is new is written as a section where the
 * file writes sections (see toml-sections.ts), and the rest of the change goes to toml-patch. A text that does not read
 * back as `after` is thrown away for toml-patch's own writing of all of it.
 */
function structural(text: string, current: unknown, after: unknown): string {
  try {
    const { rest, additions } = splitAdditions(text, current, after)
    if (additions.length > 0) {
      let out = firstDifference(current, rest) ? patch(text, reconcile(current, rest)) : text
      for (const addition of additions) out = addSection(out, addition)
      if (!firstDifference(parse(out), after)) return out
    }
  } catch {
    // Fall through: toml-patch writes it, inline where it must.
  }
  return patch(text, reconcile(current, after))
}

/** The reason toml-patch gives, without the position, source line and caret its message repeats first. */
const syntaxReason = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error)
  const reason = message.split('\n').slice(3).join(' ').trim()
  return reason === '' ? message : reason
}

/**
 * Turns `text` into the text of `after`, given `before`, the value `text` parses to. Only what differs is written,
 * a changed scalar in its literal's span alone; every other byte stays, and every number reads back exactly. A
 * refusal carries a key path, a reason and no text: `invalid-text` (the text is not TOML), `before-mismatch`, `unwritable-value` (a number that is not finite, or a
 * value TOML has no literal for) and `verify-failed` (the result would not read as `after`, or the parser's
 * positions do not slice to their literals).
 */
export function patchToml(text: string, before: unknown, after: unknown): PatchResult {
  let current: unknown
  try {
    current = parse(text)
  } catch (error) {
    return refuse([], 'invalid-text', syntaxReason(error))
  }
  const mismatch = firstDifference(current, before)
  if (mismatch)
    return refuse(
      mismatch,
      'before-mismatch',
      `the value the patch starts from differs from the text at ${keyPathText(mismatch)}`,
    )
  const unwritable = firstUnwritable(after, current)
  if (unwritable) return refuse(unwritable.path, 'unwritable-value', unwritable.detail)

  let read: ReturnType<typeof readTomlLiterals>
  try {
    read = readTomlLiterals(text)
  } catch (error) {
    // The parser's positions do not slice to a literal: refuse rather than edit at a wrong place.
    if (error instanceof TomlPositionError) return refuse([], 'verify-failed', error.message)
    throw error
  }
  const literals = new Map(read.literals.map((literal) => [keyPathText(literal.keyPath), literal]))
  const splices: Splice[] = []
  scalarSplices(current, after, [], literals, splices)
  let out = text
  for (const splice of [...splices].sort((a, b) => b.span[0] - a.span[0]))
    out = out.slice(0, splice.span[0]) + splice.text + out.slice(splice.span[1])

  let spliced: unknown
  try {
    spliced = parse(out)
  } catch (error) {
    return refuse([], 'verify-failed', `the span edits left a text that is not TOML: ${syntaxReason(error)}`)
  }
  if (firstDifference(spliced, after)) {
    try {
      out = structural(out, spliced, after)
    } catch (error) {
      // toml-patch throws where it cannot place a key; that is a refusal, not a crash.
      return refuse([], 'verify-failed', `the patch could not be written: ${syntaxReason(error)}`)
    }
  }

  let written: unknown
  try {
    written = parse(out)
  } catch (error) {
    return refuse([], 'verify-failed', `the patched text is not TOML: ${syntaxReason(error)}`)
  }
  const wrong = firstDifference(written, after)
  return wrong
    ? refuse(
        wrong,
        'verify-failed',
        `the patched text does not read as the new value at ${keyPathText(wrong)}`,
      )
    : { ok: true, text: out }
}
