// The core packages an API report covers (PRODUCT spec §2 F6): every `packages/*` folder except extensions,
// which are Automata Plus (PD-1) and versioned on their own. Entries are the source `exports` map, the one
// the workspace resolves, so private packages (runtime, render-pixi) are covered before they publish.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Folders under `packages/` that are not core, with the reason. */
export const NOT_CORE: Readonly<Record<string, string>> = {
  physics: 'an extension; moves to automata-plus with PRODUCT.5 (PD-1)',
}

export interface CoreEntry {
  /** The `exports` key, e.g. `.` or `./extension`. */
  readonly entryPoint: string
  /** The source file it resolves to, absolute. */
  readonly file: string
}

export interface CorePackage {
  /** The folder under `packages/`, e.g. `host`; names the report file. */
  readonly folder: string
  readonly dir: string
  readonly name: string
  readonly version: string
  /** `private: true` in package.json: not published, so no changeset can name it. */
  readonly private: boolean
  readonly entries: readonly CoreEntry[]
}

interface Manifest {
  readonly name: string
  readonly version: string
  readonly private?: boolean
  readonly exports?: Readonly<Record<string, unknown>>
}

/** The source file of one `exports` value: a string, or the `types`/`default`/`import`/`svelte` condition. */
function sourceTarget(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (value === null || typeof value !== 'object') return undefined
  const conditions = value as Record<string, unknown>
  for (const condition of ['types', 'default', 'import', 'svelte']) {
    const target = conditions[condition]
    if (typeof target === 'string') return target
  }
  return undefined
}

/** Every core package below `root`, sorted by folder, with its TypeScript entries in `exports` order. */
export function corePackages(
  root: string,
  notCore: Readonly<Record<string, string>> = NOT_CORE,
): CorePackage[] {
  const packagesDir = join(root, 'packages')
  const folders = readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !Object.hasOwn(notCore, entry.name))
    .map((entry) => entry.name)
    .sort()
  const found: CorePackage[] = []
  for (const folder of folders) {
    const dir = join(packagesDir, folder)
    let manifest: Manifest
    try {
      manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Manifest
    } catch {
      continue // a folder without a package.json is not a package
    }
    const entries: CoreEntry[] = []
    for (const [entryPoint, value] of Object.entries(manifest.exports ?? {})) {
      const target = sourceTarget(value)
      if (target === undefined || !/\.[cm]?ts$/.test(target)) continue // `./theme.css` has no API
      entries.push({ entryPoint, file: join(dir, target) })
    }
    found.push({
      folder,
      dir,
      name: manifest.name,
      version: manifest.version,
      private: manifest.private === true,
      entries,
    })
  }
  return found
}
