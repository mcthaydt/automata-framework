// The workspace packages Changesets would publish: every package.json under the workspace folders whose
// `private` is not `true`. `release-list.test.ts` and `verify-published.ts` both read this list,
// so the test that pins what is published and the check after a release can never disagree.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface PackageManifest {
  readonly name: string
  readonly version: string
  readonly private?: boolean
  readonly files?: readonly string[]
  readonly repository?: { readonly type: string; readonly url: string; readonly directory?: string }
  readonly exports?: Readonly<Record<string, unknown>>
  readonly bin?: Readonly<Record<string, string>>
  readonly dependencies?: Readonly<Record<string, string>>
  readonly devDependencies?: Readonly<Record<string, string>>
  readonly peerDependencies?: Readonly<Record<string, string>>
  readonly publishConfig?: {
    readonly registry?: string
    readonly exports?: Readonly<Record<string, unknown>>
    readonly bin?: Readonly<Record<string, string>>
  }
}

export interface WorkspacePackage {
  /** The folder, relative to the repository root, with `/` separators. */
  readonly dir: string
  readonly manifest: PackageManifest
}

/** Folders that hold workspace packages, one level down (`pnpm-workspace.yaml`); `examples/*\/*` is two. */
const GROUPS: readonly string[] = ['packages', 'tooling', 'games', 'examples']

function subfolders(root: string, dir: string): string[] {
  try {
    return readdirSync(join(root, dir), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== 'node_modules')
      .map((entry) => `${dir}/${entry.name}`)
      .sort()
  } catch {
    return []
  }
}

function readManifest(root: string, dir: string): PackageManifest | undefined {
  try {
    return JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8')) as PackageManifest
  } catch {
    return undefined // a folder without a package.json is not a package
  }
}

/** Every workspace package below `root`, sorted by folder. */
export function workspacePackages(root: string): WorkspacePackage[] {
  const found: WorkspacePackage[] = []
  for (const group of GROUPS) {
    for (const dir of subfolders(root, group)) {
      const manifest = readManifest(root, dir)
      if (manifest !== undefined) found.push({ dir, manifest })
      // The feature demos inside an examples package, examples/<dimension>/<module>/<name> (pnpm-workspace.yaml's
      // `examples/2d/*/*`).
      if (group === 'examples') {
        for (const inner of subfolders(root, dir).flatMap((module) => subfolders(root, module))) {
          const innerManifest = readManifest(root, inner)
          if (innerManifest !== undefined) found.push({ dir: inner, manifest: innerManifest })
        }
      }
    }
  }
  return found
}

/** The packages Changesets publishes: those whose `private` is not `true`. */
export function publishablePackages(root: string): WorkspacePackage[] {
  return workspacePackages(root).filter((pkg) => pkg.manifest.private !== true)
}
