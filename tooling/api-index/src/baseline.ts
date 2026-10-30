// "A test fails if an export has no doc comment, so new exports arrive documented" (DX spec §3.8). Exports that
// were undocumented when DX.4 landed are listed in undocumented-baseline.json. The list can only shrink: an export
// missing from it must be documented, and an entry that is documented or gone must be deleted from it.
import type { ApiExport } from './rows.ts'

/** `<package>[/<subpath>]#<name>`: the import specifier and the export name. */
export function exportId(row: ApiExport): string {
  const specifier = row.entryPoint === '.' ? row.package : `${row.package}${row.entryPoint.slice(1)}`
  return `${specifier}#${row.name}`
}

export interface DocFindings {
  /** Undocumented exports that are not in the baseline. */
  readonly undocumented: readonly string[]
  /** Baseline entries that are documented now or no longer exported. */
  readonly stale: readonly string[]
}

export function checkDocs(exports: readonly ApiExport[], baseline: readonly string[]): DocFindings {
  const allowed = new Set(baseline)
  const bare = new Set(exports.filter((row) => row.doc === '').map(exportId))
  return {
    undocumented: [...bare].filter((id) => !allowed.has(id)).sort(),
    stale: [...allowed].filter((id) => !bare.has(id)).sort(),
  }
}
