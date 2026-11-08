// The API index's rows: every export of every published entry point, read from the emitted.d.ts
// by the one extractor, tooling/api-report/src/extract.ts, which `pnpm api-report` reads source
// with; beta entries, which have no build, are read from source by the same extractor. This file only shapes and
// orders the rows of `api.json`.
import type { CorePackage } from '../../api-report/src/core-packages.ts'
import { type ApiKind, declarationExports, sourceExports } from '../../api-report/src/extract.ts'
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
  /** Only on a private package read from source, listed after the published ones; its version is not the API's. */
  readonly beta?: true
}

// en collation, so the order is the same on every machine and reads naturally (`add`, `Color`, `Counter`).
const byName = new Intl.Collator('en', { sensitivity: 'base' }).compare

/** The beta entries as the source reader wants them: one package per folder, its entries in order. */
function betaPackages(entries: readonly EntryPoint[]): CorePackage[] {
  const packages = new Map<string, CorePackage & { entries: { entryPoint: string; file: string }[] }>()
  for (const entry of entries) {
    const found = packages.get(entry.package) ?? {
      folder: entry.dir,
      dir: entry.dir,
      name: entry.package,
      version: entry.version,
      private: true,
      entries: [],
    }
    found.entries.push({ entryPoint: entry.entryPoint, file: entry.typesFile })
    packages.set(entry.package, found)
  }
  return [...packages.values()]
}

/** Every export of `entries`, sorted by published then beta, then package, entry point and name. */
export function indexRows(entries: readonly EntryPoint[]): ApiExport[] {
  const published = declarationExports(entries.filter((entry) => !entry.beta).map((entry) => entry.typesFile))
  // Comments are kept: the reference tells an agent how to use what it lists.
  const source = sourceExports(betaPackages(entries.filter((entry) => entry.beta)), true)
  const rows: ApiExport[] = []
  for (const entry of entries) {
    const exported = (entry.beta ? source : published)(entry.typesFile)
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
        ...(entry.beta ? { beta: true as const } : {}),
      })
    }
  }
  return rows.sort(
    (a, b) =>
      Number(a.beta ?? false) - Number(b.beta ?? false) ||
      a.package.localeCompare(b.package, 'en') ||
      a.entryPoint.localeCompare(b.entryPoint, 'en') ||
      byName(a.name, b.name),
  )
}
