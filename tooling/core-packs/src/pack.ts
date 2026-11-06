import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { publishablePackages, workspacePackages } from '../../release/src/publishable-packages.ts'

// Packs the workspace for a project outside it. Two consumers: the consumer smoke, which installs
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
  /**
   * With `unpack`: the folder inside the out folder that holds the tarball's contents (`package/` stripped).
   * A project installs `file:<out>/<dir>`: a directory dependency has no integrity hash in the lockfile, and
   * `pnpm pack` does not write the same bytes twice (it orders a packed manifest's dependency maps by when each
   * `workspace:` range resolved), so a tarball's hash would differ from machine to machine.
   */
  readonly dir?: string
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
  /** Also extract each tarball into a folder of its own (see `PackedPackage.dir`). */
  readonly unpack?: boolean
  /** Extracts `tarball` into `dir`, dropping the leading `package/`. */
  readonly unpackTarball?: (tarball: string, dir: string) => void
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

function tarUnpack(tarball: string, dir: string): void {
  mkdirSync(dir, { recursive: true })
  execFileSync('tar', ['-xzf', tarball, '-C', dir, '--strip-components=1'], { stdio: 'pipe' })
}

/** The folders an earlier run's `packs.json` says it made. */
function earlierFolders(out: string): string[] {
  try {
    const earlier = JSON.parse(readFileSync(join(out, 'packs.json'), 'utf8')) as {
      packs?: { dir?: string }[]
    }
    return (earlier.packs ?? []).flatMap((pack) => (pack.dir === undefined ? [] : [pack.dir]))
  } catch {
    return []
  }
}

/**
 * Clears an earlier run's packs and the folders its `packs.json` names; refuses a folder that holds anything
 * else, so no unrelated file or folder is deleted.
 */
function prepare(out: string): void {
  if (!existsSync(out)) {
    mkdirSync(out, { recursive: true })
    return
  }
  const made = new Set(earlierFolders(out))
  const names = readdirSync(out)
  const foreign = names.filter((name) => name !== 'packs.json' && !name.endsWith('.tgz') && !made.has(name))
  if (foreign.length > 0) throw new Error(`${out} holds files that are not packs: ${foreign.join(', ')}`)
  for (const name of names) rmSync(join(out, name), { recursive: true })
}

/** `@mcthaydt/automata-sim` → `automata-sim`: the folder a pack unpacks to. */
const folderOf = (name: string): string => name.replace(/^@[^/]+\//, '')

export function packWorkspace(options: PackOptions): PackManifest {
  if (!SOURCE_COMMIT.test(options.sourceCommit))
    throw new Error(`source commit must be 40 hex characters, optionally +dirty: ${options.sourceCommit}`)
  const pack = options.pack ?? pnpmPack
  const readPackedManifest = options.readPackedManifest ?? tarManifest
  const unpackTarball = options.unpackTarball ?? tarUnpack

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
  // A published package ships `dist`; an extra (a private tool) exports its source, unless it publishes built exports
  // (`publishConfig.exports`, as the sector format does), which `pnpm pack` applies, so its `dist` must exist too.
  const shipsDist = [
    ...published,
    ...extras.filter((pkg) => pkg.manifest.publishConfig?.exports !== undefined),
  ]
  for (const pkg of shipsDist) {
    if (!existsSync(join(options.root, pkg.dir, 'dist')))
      throw new Error(`${pkg.dir}/dist is missing: run pnpm build first`)
  }

  if (options.unpack === true) {
    const seen = new Map<string, string>()
    for (const pkg of wanted) {
      const folder = folderOf(pkg.manifest.name)
      const other = seen.get(folder)
      if (other !== undefined) throw new Error(`${other} and ${pkg.manifest.name} both unpack to ${folder}`)
      seen.set(folder, pkg.manifest.name)
    }
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
    const entry: PackedPackage = {
      name: pkg.manifest.name,
      version: pkg.manifest.version,
      file,
      sha256: createHash('sha256').update(readFileSync(tarball)).digest('hex'),
    }
    if (options.unpack !== true) return entry
    const dir = folderOf(pkg.manifest.name)
    unpackTarball(tarball, join(options.out, dir))
    return { ...entry, dir }
  })
  const manifest: PackManifest = { sourceCommit: options.sourceCommit, packs }
  writeFileSync(join(options.out, 'packs.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}
