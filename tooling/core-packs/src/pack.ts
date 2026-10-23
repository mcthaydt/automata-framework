import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { publishablePackages, workspacePackages } from '../../release/src/publishable-packages.ts'

// Packs the workspace for a project outside it (PRODUCT.5b). Two consumers: the consumer smoke, which installs
// what a game would get, and `automata-plus`, which installs core from a pinned commit while core has no
// registry (P5-D1). A tarball from `pnpm pack` has `workspace:*` turned into exact versions and `publishConfig`
// applied, so the project sees what the registry would serve; an override that points each `@mcthaydt/*` name at
// its tarball (pnpm-workspace.yaml) stands in for the registry.

export interface PackedPackage {
  readonly name: string
  readonly version: string
  /** The tarball's file name inside the out folder. */
  readonly file: string
  readonly sha256: string
}

/** `packs.json`: what a project outside the workspace needs to install the packs. */
export interface PackManifest {
  /** The commit the packs were built from: 40 hex characters, `+dirty` when the tree had uncommitted changes. */
  readonly sourceCommit: string
  readonly packs: readonly PackedPackage[]
}

export interface PackedManifest {
  readonly name: string
  readonly version: string
  readonly dependencies?: Readonly<Record<string, string>>
  readonly devDependencies?: Readonly<Record<string, string>>
  readonly peerDependencies?: Readonly<Record<string, string>>
  readonly optionalDependencies?: Readonly<Record<string, string>>
}

export interface PackOptions {
  /** The workspace root. */
  readonly root: string
  /** Where the tarballs and `packs.json` go. Created if missing; may hold only an earlier run's packs. */
  readonly out: string
  /** Private workspace packages to pack as well as the published ones (for example `@mcthaydt/evidence`). */
  readonly extras: readonly string[]
  readonly sourceCommit: string
  /** Packs the package in `dir` into `destination` and returns the new tarball's file name. */
  readonly pack?: (dir: string, destination: string) => string
  /** Reads `package.json` out of a tarball. */
  readonly readPackedManifest?: (tarball: string) => PackedManifest
}

const SOURCE_COMMIT = /^[0-9a-f]{40}(\+dirty)?$/

function pnpmPack(dir: string, destination: string): string {
  const before = new Set(readdirSync(destination))
  execFileSync('pnpm', ['pack', '--pack-destination', destination], { cwd: dir, stdio: 'pipe' })
  const file = readdirSync(destination).find((name) => !before.has(name))
  if (file === undefined) throw new Error(`pnpm pack wrote nothing in ${dir}`)
  return file
}

function tarManifest(tarball: string): PackedManifest {
  const json = execFileSync('tar', ['-xOzf', tarball, 'package/package.json'], { encoding: 'utf8' })
  return JSON.parse(json) as PackedManifest
}

/** Clears an earlier run's packs; refuses a folder that holds anything else, so no unrelated file is deleted. */
function prepare(out: string): void {
  if (!existsSync(out)) {
    mkdirSync(out, { recursive: true })
    return
  }
  const names = readdirSync(out)
  const foreign = names.filter((name) => name !== 'packs.json' && !name.endsWith('.tgz'))
  if (foreign.length > 0) throw new Error(`${out} holds files that are not packs: ${foreign.join(', ')}`)
  for (const name of names) rmSync(join(out, name))
}

export function packWorkspace(options: PackOptions): PackManifest {
  if (!SOURCE_COMMIT.test(options.sourceCommit))
    throw new Error(`source commit must be 40 hex characters, optionally +dirty: ${options.sourceCommit}`)
  const pack = options.pack ?? pnpmPack
  const readPackedManifest = options.readPackedManifest ?? tarManifest

  const published = publishablePackages(options.root)
  const everything = workspacePackages(options.root)
  const extras = options.extras.map((name) => {
    const found = everything.find((pkg) => pkg.manifest.name === name)
    if (found === undefined) throw new Error(`extra ${name} is not a workspace package`)
    return found
  })
  const wanted = [...new Map([...published, ...extras].map((pkg) => [pkg.manifest.name, pkg])).values()].sort(
    (a, b) => a.manifest.name.localeCompare(b.manifest.name),
  )
  // A published package ships `dist`; an extra (a private tool) exports its source.
  for (const pkg of published) {
    if (!existsSync(join(options.root, pkg.dir, 'dist')))
      throw new Error(`${pkg.dir}/dist is missing: run pnpm build first`)
  }

  prepare(options.out)
  const packs = wanted.map((pkg): PackedPackage => {
    const file = pack(join(options.root, pkg.dir), options.out)
    const tarball = join(options.out, file)
    const packed = readPackedManifest(tarball)
    for (const field of [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ] as const) {
      for (const [name, range] of Object.entries(packed[field] ?? {})) {
        if (range.startsWith('workspace:'))
          throw new Error(`${pkg.manifest.name} has a workspace: range after packing: ${name} ${range}`)
      }
    }
    return {
      name: pkg.manifest.name,
      version: pkg.manifest.version,
      file,
      sha256: createHash('sha256').update(readFileSync(tarball)).digest('hex'),
    }
  })
  const manifest: PackManifest = { sourceCommit: options.sourceCommit, packs }
  writeFileSync(join(options.out, 'packs.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}
