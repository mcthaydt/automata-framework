// The entry points the API index covers: every `exports` key with a `types` target, of every package Changesets
// publishes (DX spec §3.8). The published list is tooling/release's, imported so the two can never disagree.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { publishablePackages } from '../../release/src/publishable-packages.ts'

export interface EntryPoint {
  /** The package name, e.g. `@mcthaydt/automata-sim`. */
  readonly package: string
  /** The `exports` key, e.g. `.` or `./math`. */
  readonly entryPoint: string
  /** The emitted declaration file, absolute. */
  readonly typesFile: string
  readonly version: string
}

/** A published entry point's `.d.ts` does not exist: the packages have not been built. */
export class MissingTypesError extends Error {
  override readonly name = 'MissingTypesError'
}

/** The `types` target of one `exports` value, if it has one (`./theme.css` has none). */
function typesTarget(entry: unknown): string | undefined {
  if (entry === null || typeof entry !== 'object') return undefined
  const types = (entry as { types?: unknown }).types
  return typeof types === 'string' ? types : undefined
}

/** Every typed entry point of every published package below `root`, by package then `exports` order. */
export function entryPoints(root: string): EntryPoint[] {
  const found: EntryPoint[] = []
  for (const { dir, manifest } of publishablePackages(root)) {
    // What consumers install is publishConfig's map when there is one (M2.4 spec §3.2).
    const exportsMap = manifest.publishConfig?.exports ?? manifest.exports ?? {}
    for (const [entryPoint, entry] of Object.entries(exportsMap)) {
      const types = typesTarget(entry)
      if (types === undefined) continue
      const typesFile = join(root, dir, types)
      if (!existsSync(typesFile)) {
        throw new MissingTypesError(
          `${manifest.name} ${entryPoint}: ${types} does not exist; run pnpm build first`,
        )
      }
      found.push({ package: manifest.name, entryPoint, typesFile, version: manifest.version })
    }
  }
  return found
}
