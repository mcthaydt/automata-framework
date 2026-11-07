// The API index's rows: every export of every published entry point, read from the emitted.d.ts
// by the one extractor, tooling/api-report/src/extract.ts, which `pnpm api-report` reads source
// with. This file only shapes and orders the rows of `api.json`.
import { type ApiKind, declarationExports } from '../../api-report/src/extract.ts'
import type { EntryPoint } from './entry-points.ts'

/** One export of one published entry point, for one version: a row of `api.json`. */
export interface ApiExport {
  readonly package: string
  readonly entryPoint: string
  readonly name: string
  readonly kind: ApiKind
  /**
   * The declaration as written in the `.d.ts`, without `export`/`declare`, overloads one per line; for an export
   * whose alias resolves to nothing, the module it comes from (`component from '<file>'`, `from '<module>'`).
   */
  readonly signature: string
  /** The doc comment (each overload's, joined) and its `@tags`, one per line; empty when there is none. */
  readonly doc: string
  readonly version: string
}

// en collation, so the order is the same on every machine and reads naturally (`add`, `Color`, `Counter`).
const byName = new Intl.Collator('en', { sensitivity: 'base' }).compare

/** Every export of `entries`, sorted by package, entry point and name. */
export function indexRows(entries: readonly EntryPoint[]): ApiExport[] {
  // An import of another published package resolves to that package's built declaration (`<package>` or
  // `<package>/<entry>`), the same way the source reader maps workspace imports to source.
  const paths: Record<string, string[]> = {}
  for (const entry of entries) paths[`${entry.package}${entry.entryPoint.slice(1)}`] = [entry.typesFile]
  const exportsOf = declarationExports(
    entries.map((entry) => entry.typesFile),
    paths,
  )
  const rows: ApiExport[] = []
  for (const entry of entries) {
    const exported = exportsOf(entry.typesFile)
    if (exported === undefined) throw new Error(`${entry.typesFile} is not a module`)
    for (const { name, kind, declaration, doc } of exported) {
      // The key order is api.json's field order.
      rows.push({
        package: entry.package,
        entryPoint: entry.entryPoint,
        name,
        kind,
        signature: declaration,
        doc,
        version: entry.version,
      })
    }
  }
  return rows.sort(
    (a, b) =>
      a.package.localeCompare(b.package, 'en') ||
      a.entryPoint.localeCompare(b.entryPoint, 'en') ||
      byName(a.name, b.name),
  )
}
