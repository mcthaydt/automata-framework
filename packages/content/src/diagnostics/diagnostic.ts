// Authoring diagnostics. Extracted from FloorFifty packages/content/src/diagnostics.ts (122a220).
//
// Every refusal in this package is one of these: a stable code, the project-relative file an author has
// to open, where in it (1-based line and column), the dotted key inside it, and a message that says what
// to write instead. Nothing here throws: the compiler collects independent failures so one save reports
// all of them.

/** Stable codes. Tests and tools match on these, so a code is never renamed, only added. */
export type DiagnosticCode =
  | 'invalidToml'
  | 'invalidType'
  | 'missingField'
  | 'unknownField'
  | 'invalidId'
  | 'unknownReference'
  | 'wrongKind'
  | 'outOfRange'
  | 'invariantNotAuthorable'
  | 'invalidFlow'
  | 'invalidPalette'
  | 'invalidGame'
  | 'missingAsset'
  | 'duplicateMessageKey'
  | 'staleTranslation'
  | 'staleArtifact'
  | 'generatorFailed'

export interface Diagnostic {
  readonly code: DiagnosticCode
  /** Project-relative, `/`-separated, e.g. `content/tuning.toml`. */
  readonly file: string
  readonly line: number
  readonly column: number
  /** Dotted path inside the file (`transitions.3.to`), or '' for the whole file. */
  readonly keyPath: string
  readonly message: string
}

/** `content/tuning.toml:12:1  GRAVITY  outOfRange: expected -1200..-100, received -2000` */
export function formatDiagnostic(d: Diagnostic): string {
  const where = `${d.file}:${d.line}:${d.column}`
  const key = d.keyPath === '' ? '' : `  ${d.keyPath}`
  return `${where}${key}  ${d.code}: ${d.message}`
}

// Plain code-unit comparison rather than localeCompare: the order must not depend on the machine's locale.
const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/**
 * The one ordering every pass uses. Diagnostics are gathered by several independent checks, so without a
 * single comparator the same broken file would report its problems in a different order on different runs.
 */
export function compareDiagnostics(a: Diagnostic, b: Diagnostic): number {
  return (
    compareText(a.file, b.file) ||
    a.line - b.line ||
    a.column - b.column ||
    compareText(a.keyPath, b.keyPath) ||
    compareText(a.code, b.code) ||
    compareText(a.message, b.message)
  )
}

export function sortDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return [...diagnostics].sort(compareDiagnostics)
}
