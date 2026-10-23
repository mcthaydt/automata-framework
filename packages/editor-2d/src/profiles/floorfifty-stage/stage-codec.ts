import { parse, patch } from '@decimalturn/toml-patch'
import type { z } from 'zod'
import type { ParseError, Result } from '../profile'
import { type StageValue, stageSchema } from './stage.schema'
import { documentOfLoadedValue, type StageDocument } from './stage-document'
import { findLine, scanBlocks, splitLines } from './toml-blocks'

// Reading and writing a stage file (2D editor spec §10.3). `parseStage` gives every problem of a text a position, so
// the editor can show where and can refuse to replace the file with a half-read one (acceptance G-c).

type SchemaIssue = z.core.$ZodIssue

/** `theme.layers[3].sink`: the dotted path of a value, with the index of a list element. */
function pathText(path: readonly PropertyKey[]): string {
  let text = ''
  for (const key of path) {
    if (typeof key === 'number') text += `[${key}]`
    else text += text === '' ? String(key) : `.${String(key)}`
  }
  return text
}

interface SyntaxFailure {
  readonly message: string
  readonly line?: number
  readonly column?: number
}

/**
 * `toml-patch` throws an `Error` with a 1-based `line` and a 0-based `column`, and a message that repeats the position,
 * the source line and a caret before the reason; only the reason is kept here. Its recursion limit throws a bare
 * `RangeError` for a text nested tens of thousands deep, which has a message and no position.
 */
function syntaxFailure(error: unknown): SyntaxFailure {
  const { message, line, column } = error as Error & { line?: unknown; column?: unknown }
  const reason = message.split('\n').slice(3).join(' ').trim()
  return {
    message: reason === '' ? message : reason,
    ...(typeof line === 'number' ? { line } : {}),
    ...(typeof column === 'number' ? { column: column + 1 } : {}),
  }
}

/** One error for the issue, or one for each key of an `unrecognized_keys` issue, which Zod reports at the object. */
function schemaErrors(lines: readonly string[], issues: readonly SchemaIssue[]): ParseError[] {
  const blocks = scanBlocks(lines)
  const errors: ParseError[] = []
  for (const issue of issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) {
        const path = [...issue.path, key]
        errors.push({
          code: issue.code,
          message: `Unrecognized key: "${key}"`,
          path: pathText(path),
          line: findLine(lines, blocks, path),
        })
      }
      continue
    }
    errors.push({
      code: issue.code,
      message: issue.message,
      path: pathText(issue.path),
      line: findLine(lines, blocks, issue.path),
    })
  }
  return errors
}

export function parseStage(text: string): Result<StageDocument, readonly ParseError[]> {
  let raw: unknown
  try {
    raw = parse(text)
  } catch (error) {
    const { message, line, column } = syntaxFailure(error)
    return { ok: false, error: [{ code: 'tomlSyntax', message, line, column }] }
  }
  const checked = stageSchema.safeParse(raw)
  if (!checked.success)
    return { ok: false, error: schemaErrors(splitLines(text).lines, checked.error.issues) }
  const value: StageValue = checked.data
  return { ok: true, value: documentOfLoadedValue(value) }
}

// -- printing ----------------------------------------------------------------------------------------------------

type Data = Record<string, unknown>

const isData = (value: unknown): value is Data =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A copy without the keys whose value is `undefined`, which are optional keys the value does not have. */
function withoutUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutUndefined)
  if (!isData(value)) return value
  const copy: Data = {}
  for (const [key, child] of Object.entries(value))
    if (child !== undefined) copy[key] = withoutUndefined(child)
  return copy
}

/**
 * The value as the TOML data `patch` compares with the text. An empty list is the same as no list for the schema, which
 * defaults `setPieces` to empty, so an empty list the text does not spell out is left out and `patch` adds no key for it.
 */
function tomlData(value: StageValue, base: Data): Data {
  const data = withoutUndefined(value) as Data
  const theme = data.theme as Data
  const baseTheme = base.theme as Data
  if ((theme.setPieces as unknown[]).length === 0 && baseTheme.setPieces === undefined) delete theme.setPieces
  return data
}

/**
 * The text of a document: `base` (the text it was read from) with exactly the changes the document has. `toml-patch`
 * carries every change that keeps the shape of the file, and keeps its comments, blank lines and line endings.
 * Throws when `base` is not TOML, which a document read from it cannot be.
 */
export function printStage(base: string, document: StageDocument): string {
  return patch(base, tomlData(document.value, parse(base) as Data))
}
