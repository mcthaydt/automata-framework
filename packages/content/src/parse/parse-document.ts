// Parsing one authored file: TOML first, then the file's Zod schema.
// Extracted from FloorFifty packages/content/src/parse.ts (`parseFile`, `toDiagnostics`, 122a220) and made
// generic over any schema. This is the only module that imports the TOML parser, which keeps the format an
// authoring detail rather than a runtime dependency.

import { parse as parseToml, TomlError } from 'smol-toml'
import type { z } from 'zod'
import type { Diagnostic, DiagnosticCode } from '../diagnostics/diagnostic'
import { type KeyIndex, locateKeys, positionOf } from './locate-keys'

/** One authored file, with the project-relative path a diagnostic names. */
export interface SourceFile {
  readonly file: string
  readonly text: string
}

/** A parsed TOML file and where its keys are, before any schema has looked at it. */
export interface ParsedToml {
  readonly file: string
  readonly raw: unknown
  readonly keys: KeyIndex
}

export type TomlResult =
  | { readonly ok: true; readonly toml: ParsedToml }
  | { readonly ok: false; readonly diagnostics: Diagnostic[] }

export type DocumentResult<T> =
  | { readonly ok: true; readonly value: T; readonly toml: ParsedToml }
  | { readonly ok: false; readonly diagnostics: Diagnostic[] }

type PathSegment = PropertyKey

/** A diagnostic placed at a key of a parsed file (or the deepest part of its path that exists). */
export function diagnosticAt(
  toml: Pick<ParsedToml, 'file' | 'keys'>,
  code: DiagnosticCode,
  path: readonly PathSegment[],
  message: string,
): Diagnostic {
  const segments = path.map((segment) => (typeof segment === 'number' ? segment : String(segment)))
  const { line, column } = positionOf(toml.keys, segments)
  return { code, file: toml.file, line, column, keyPath: segments.join('.'), message }
}

/** smol-toml's messages start with a fixed prefix and may carry a code excerpt; keep the first line only. */
function tomlMessage(error: TomlError): string {
  const first = error.message.split('\n')[0] ?? error.message
  return first.replace(/^Invalid TOML document: /, '')
}

export function parseTomlFile(source: SourceFile): TomlResult {
  try {
    const raw: unknown = parseToml(source.text)
    return { ok: true, toml: { file: source.file, raw, keys: locateKeys(source.text) } }
  } catch (error) {
    if (!(error instanceof TomlError)) throw error
    const diagnostic: Diagnostic = {
      code: 'invalidToml',
      file: source.file,
      line: error.line,
      column: error.column,
      keyPath: '',
      message: tomlMessage(error),
    }
    return { ok: false, diagnostics: [diagnostic] }
  }
}

/** The authored value at a Zod path, to tell "absent" from "wrong". */
function valueAt(root: unknown, path: readonly PathSegment[]): unknown {
  let current = root
  for (const key of path) {
    if (typeof current !== 'object' || current === null) return undefined
    current = (current as Record<PropertyKey, unknown>)[key]
  }
  return current
}

/**
 * Turns one file's schema failure into diagnostics an author can act on. An unrecognized-keys issue becomes
 * one diagnostic per key, because reporting "two unknown fields" and naming neither is how a typo survives
 * a fix (FloorFifty).
 */
export function schemaDiagnostics(toml: ParsedToml, issues: readonly z.core.$ZodIssue[]): Diagnostic[] {
  return issues.flatMap((issue) => {
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) =>
        diagnosticAt(toml, 'unknownField', [...issue.path, key], `unknown field: ${key}`),
      )
    }
    const absent = issue.code === 'invalid_type' && valueAt(toml.raw, issue.path) === undefined
    if (absent) return [diagnosticAt(toml, 'missingField', issue.path, 'required')]
    return [diagnosticAt(toml, 'invalidType', issue.path, issue.message)]
  })
}

export function parseDocument<T>(source: SourceFile, schema: z.ZodType<T>): DocumentResult<T> {
  const parsed = parseTomlFile(source)
  if (!parsed.ok) return parsed
  const result = schema.safeParse(parsed.toml.raw)
  if (!result.success) return { ok: false, diagnostics: schemaDiagnostics(parsed.toml, result.error.issues) }
  return { ok: true, value: result.data, toml: parsed.toml }
}
