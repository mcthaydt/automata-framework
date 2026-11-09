// The entry points the API index covers: every `exports` key with a `types` target, of every package Changesets
// publishes (the published list is tooling/release's, imported so the two can never disagree), and then the private
// packages a new 2D or story game imports, as beta. A game made inside this repository imports them from source, so the
// agent that writes it needs their API too; they have no build, so each is read from its source file.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sourceTarget } from '../../api-report/src/core-packages.ts'
import { publishablePackages, workspacePackages } from '../../release/src/publishable-packages.ts'

export interface EntryPoint {
  /** The package name, e.g. `@automata/sim`. */
  readonly package: string
  /** The `exports` key, e.g. `.` or `./math`. */
  readonly entryPoint: string
  /** The emitted declaration file, absolute; for a beta entry, its source file. */
  readonly typesFile: string
  readonly version: string
  /** The package folder, absolute. */
  readonly dir: string
  /** A private package a new game imports from source: not published yet, so its version is not the API's. */
  readonly beta: boolean
}

/**
 * The 3D packages, left out until 3D is public (Owner, 2026-11-08: launch waits for it). The 3D template files are
 * not read, and these two are named as well so a 2D template can never pull one in by accident.
 */
export const HELD_UNTIL_3D_PUBLIC: readonly string[] = ['@automata/3d', '@automata/sectors']

/** A published entry point's `.d.ts` does not exist: the packages have not been built. */
export class MissingTypesError extends Error {
  override readonly name = 'MissingTypesError'
}

/** Where the new-game templates are written. */
const TEMPLATES = 'packages/tools/src/shared/create-game'

/** The 3D templates and their gate are not 2D or story templates. */
const isTwoDimensional = (name: string) => !name.startsWith('template-3d') && name.startsWith('template')

function templateFiles(dir: string): string[] {
  const found: string[] = []
  if (!existsSync(dir)) return found
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!isTwoDimensional(entry.name)) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...templateFiles(path))
    else if (entry.name.endsWith('.ts')) found.push(path)
  }
  return found
}

/** Every `@automata/<name>[/<entry>]` the 2D and story templates import, as written in the template text. */
export function templateImports(root: string): ReadonlySet<string> {
  const found = new Set<string>()
  for (const file of templateFiles(join(root, TEMPLATES))) {
    for (const match of readFileSync(file, 'utf8').matchAll(/(?:from|import)\s*'(@automata\/[^']+)'/g)) {
      found.add(match[1] as string)
    }
  }
  return found
}

/** The package name and `exports` key of an import specifier: `@automata/nav/sim` is `@automata/nav` and `./sim`. */
function splitSpecifier(specifier: string): { name: string; entryPoint: string } {
  const [scope, name, ...rest] = specifier.split('/')
  return { name: `${scope}/${name}`, entryPoint: rest.length === 0 ? '.' : `./${rest.join('/')}` }
}

/** The `types` target of one `exports` value, if it has one (`./theme.css` has none). */
function typesTarget(entry: unknown): string | undefined {
  if (entry === null || typeof entry !== 'object') return undefined
  const types = (entry as { types?: unknown }).types
  return typeof types === 'string' ? types : undefined
}

function publishedEntries(root: string): EntryPoint[] {
  const found: EntryPoint[] = []
  for (const { dir, manifest } of publishablePackages(root)) {
    // What consumers install is publishConfig's map when there is one.
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
      found.push({
        package: manifest.name,
        entryPoint,
        typesFile,
        version: manifest.version,
        dir: join(root, dir),
        beta: false,
      })
    }
  }
  return found
}

/** The existing source file one `exports` value points at. */
function sourceFile(root: string, dir: string, value: unknown): string | undefined {
  const target = sourceTarget(value)
  const file = target === undefined ? undefined : join(root, dir, target)
  return file !== undefined && existsSync(file) ? file : undefined
}

/** The private packages' entries that a 2D or story template imports, in each package's `exports` order. */
export function betaEntries(root: string): EntryPoint[] {
  const wanted = new Map<string, Set<string>>()
  for (const specifier of templateImports(root)) {
    const { name, entryPoint } = splitSpecifier(specifier)
    if (HELD_UNTIL_3D_PUBLIC.includes(name)) continue
    wanted.set(name, (wanted.get(name) ?? new Set()).add(entryPoint))
  }
  const found: EntryPoint[] = []
  for (const { dir, manifest } of workspacePackages(root)) {
    const entryPoints = wanted.get(manifest.name)
    if (entryPoints === undefined || manifest.private !== true) continue
    const exportsMap = manifest.exports ?? {}
    // Every import must resolve: a template naming an entry its package lacks is an error, not a gap in the reference.
    for (const entryPoint of entryPoints) {
      if (sourceFile(root, dir, exportsMap[entryPoint]) === undefined) {
        throw new MissingTypesError(
          `${manifest.name}${entryPoint.slice(1)}: a template imports it, but the package has no source file for it`,
        )
      }
    }
    for (const [entryPoint, value] of Object.entries(exportsMap)) {
      const file = entryPoints.has(entryPoint) ? sourceFile(root, dir, value) : undefined
      if (file !== undefined) {
        found.push({
          package: manifest.name,
          entryPoint,
          typesFile: file,
          version: manifest.version,
          dir: join(root, dir),
          beta: true,
        })
      }
    }
  }
  return found
}

/** Every typed entry point of every published package below `root`, then the beta ones, each by `exports` order. */
export function entryPoints(root: string): EntryPoint[] {
  return [...publishedEntries(root), ...betaEntries(root)]
}
