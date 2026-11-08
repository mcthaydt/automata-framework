// Parsing one authored file: TOML first, then the file's Zod schema.
// It is generic over any schema. This is the only module that imports the TOML parser, which keeps the format an
// authoring detail rather than a runtime dependency.

import { parse as parseToml, TomlDate, TomlError } from 'smol-toml'
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

/** How TOML writes a non-finite number, for the message. */
const tomlNumber = (value: number): string => (Number.isNaN(value) ? 'nan' : value > 0 ? 'inf' : '-inf')

/**
 * Puts TOML-only values into JSON's terms, which content is hashed and shipped in:
 *   - a date or time becomes its canonical ISO string (smol-toml's `TomlDate.toISOString` keeps local
 *     dates, local times and offsets as written), so a schema reads it as a string;
 *   - `nan` and `inf` have no JSON form, so each one is a problem at its key.
 * Every other value passes through unchanged.
 */
function toJsonValues(
  raw: unknown,
  nonFinite: (string | number)[][],
  reserved: (string | number)[][],
): unknown {
  const walk = (node: unknown, path: (string | number)[]): unknown => {
    if (node instanceof TomlDate) return node.toISOString()
    if (typeof node === 'number' && !Number.isFinite(node)) nonFinite.push(path)
    if (Array.isArray(node)) return node.map((child, index) => walk(child, [...path, index]))
    if (typeof node === 'object' && node !== null) {
      const out: Record<string, unknown> = {}
      for (const [key, child] of Object.entries(node)) {
        // `out.__proto__ = x` sets the prototype instead of a key, and every later copy (the schema, the
        // canonical JSON) would do the same, so the key is refused rather than silently dropped (audit of
        // PR #8). `constructor` and `prototype` are ordinary own keys and stay data.
        if (key === '__proto__') reserved.push([...path, key])
        else out[key] = walk(child, [...path, key])
      }
      return out
    }
    return node
  }
  return walk(raw, [])
}

const valueAtPath = (root: unknown, path: readonly (string | number)[]): unknown =>
  path.reduce<unknown>((node, key) => (node as Record<string | number, unknown>)[key], root)

export function parseTomlFile(source: SourceFile): TomlResult {
  // CRLF and LF checkouts of one file must give one value: inside a multi-line string the line ending is
  // part of the text, and so of the hash. Lines and columns do not change.
  const text = source.text.replaceAll('\r\n', '\n')
  let parsed: unknown
  try {
    parsed = parseToml(text)
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
  const nonFinite: (string | number)[][] = []
  const reserved: (string | number)[][] = []
  const raw = toJsonValues(parsed, nonFinite, reserved)
  const toml: ParsedToml = { file: source.file, raw, keys: locateKeys(text) }
  if (nonFinite.length === 0 && reserved.length === 0) return { ok: true, toml }
  const reservedDiagnostics = reserved.map((path) =>
    diagnosticAt(
      toml,
      'reservedKey',
      path,
      "__proto__ cannot be a key, because JavaScript reads it as the object's prototype; rename it",
    ),
  )
  const nonFiniteDiagnostics = nonFinite.map((path) => {
    const received = tomlNumber(valueAtPath(parsed, path) as number)
    const keyPath = path.join('.')
    return diagnosticAt(toml, 'invalidType', path, `${keyPath} must be a finite number, received ${received}`)
  })
  return { ok: false, diagnostics: [...reservedDiagnostics, ...nonFiniteDiagnostics] }
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
 * a fix.
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
