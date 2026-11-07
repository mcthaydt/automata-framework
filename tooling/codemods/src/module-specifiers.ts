// Reading module specifiers and the names imported through them, for the module-move codemod (move-modules.ts).

import { parseSync } from 'oxc-parser'
import { extraSpans, MOCK_SPECIFIERS, specifierSpans, stringRanges } from '#src/move-tests.ts'

export interface Occurrence {
  readonly start: number
  readonly end: number
  readonly value: string
}

/** Every module specifier in a file, with the span of its text (quotes excluded). */
export function specifiersOf(file: string, code: string): Occurrence[] {
  const seen = new Set<number>()
  const unique = (spans: Occurrence[]): Occurrence[] =>
    spans.filter((span) => (seen.has(span.start) ? false : (seen.add(span.start), true)))
  if (file.endsWith('.svelte')) {
    const found: Occurrence[] = []
    for (const match of code.matchAll(/\b(?:from|import)\s*(['"])(?<value>[^'"\n]+)\1/g)) {
      const value = match.groups?.value ?? ''
      const start = match.index + match[0].lastIndexOf(value, match[0].length - 2)
      found.push({ start, end: start + value.length, value })
    }
    return unique(found)
  }
  const strings = stringRanges(file, code)
  return unique([...specifierSpans(file, code), ...extraSpans(code, MOCK_SPECIFIERS, 'module', strings)])
}

export interface ImportedNames {
  readonly statement: { start: number; end: number; isType: boolean }
  readonly entries: readonly { imported: string; local: string; isType: boolean }[]
}

/** The named imports of the statements that import `specifier` (TypeScript only), with where each statement is. */
export function importedNames(file: string, code: string, specifier: string): ImportedNames[] {
  if (file.endsWith('.svelte')) return []
  const { module } = parseSync(file, code)
  const found: ImportedNames[] = []
  for (const statement of module.staticImports) {
    if (statement.moduleRequest.value !== specifier) continue
    const entries = statement.entries.map((entry) => ({
      imported:
        entry.importName.kind === 'Name'
          ? (entry.importName.name as string)
          : entry.importName.kind === 'Default'
            ? 'default'
            : '*',
      local: entry.localName.value,
      isType: entry.isType,
    }))
    const isType =
      entries.length > 0 &&
      entries.every((entry) => entry.isType) &&
      /^\s*import\s+type\b/.test(code.slice(statement.start, statement.end))
    found.push({ statement: { start: statement.start, end: statement.end, isType }, entries })
  }
  return found
}

/** The names a file imports or re-exports from `specifier`; `*` for a namespace or `export *`. */
export function namesFrom(file: string, code: string, specifier: string): string[] {
  if (file.endsWith('.svelte')) return ['*']
  const { module } = parseSync(file, code)
  const names = new Set<string>()
  for (const statement of module.staticImports)
    if (statement.moduleRequest.value === specifier)
      for (const entry of statement.entries)
        names.add(
          entry.importName.kind === 'Name'
            ? (entry.importName.name as string)
            : entry.importName.kind === 'Default'
              ? 'default'
              : '*',
        )
  for (const exported of module.staticExports)
    for (const entry of exported.entries)
      if (entry.moduleRequest?.value === specifier)
        names.add(entry.importName.kind === 'Name' ? (entry.importName.name as string) : '*')
  return [...names].sort()
}
