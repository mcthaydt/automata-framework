import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { publishablePackages } from '../../release/src/publishable-packages.ts'

// Packs the workspace's published packages for a project outside it (the consumer smoke and the stranger's journey),
// exactly as they are published: `pnpm pack` turns `workspace:*` into exact versions and applies `publishConfig`, so
// the project installs what the registry would serve. A pack that still has a `workspace:` range would install from
// nowhere, so it fails here, naming the package and the range.

export interface Packed {
  readonly name: string
  /** The tarball's file name inside the out folder. */
  readonly file: string
}

/** The dependency maps of a packed `package.json`. */
export interface PackedManifest {
  readonly dependencies?: Readonly<Record<string, string>>
  readonly devDependencies?: Readonly<Record<string, string>>
  readonly peerDependencies?: Readonly<Record<string, string>>
  readonly optionalDependencies?: Readonly<Record<string, string>>
}

export interface PackOptions {
  /** The workspace root. */
  readonly root: string
  /** Where the tarballs go. Created if missing; may hold only an earlier run's tarballs. */
  readonly out: string
  /** Packs the package in `dir` into `destination` and returns the new tarball's file name (`pnpm pack`). */
  readonly pack?: (dir: string, destination: string) => string
  /** Reads `package.json` out of a tarball (`tar`). */
  readonly readPackedManifest?: (tarball: string) => PackedManifest
}

function pnpmPack(dir: string, destination: string): string {
  const before = new Set(readdirSync(destination))
  execFileSync('pnpm', ['pack', '--pack-destination', destination], { cwd: dir, stdio: 'pipe' })
  const file = readdirSync(destination).find((name) => !before.has(name))
  if (file === undefined) throw new Error(`pnpm pack wrote nothing in ${dir}`)
  return file
}

function tarManifest(tarball: string): PackedManifest {
  return JSON.parse(execFileSync('tar', ['-xOzf', tarball, 'package/package.json'], { encoding: 'utf8' }))
}

/** Empties the out folder of an earlier run's tarballs; refuses one holding anything else, so nothing else is deleted. */
function prepare(out: string): void {
  mkdirSync(out, { recursive: true })
  const names = readdirSync(out)
  const foreign = names.filter((name) => !name.endsWith('.tgz'))
  if (foreign.length > 0) throw new Error(`${out} holds files that are not packs: ${foreign.join(', ')}`)
  for (const name of names) rmSync(join(out, name))
}

const FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const

/** Packs every published package, sorted by name, into `out`. Every package needs its `dist` (`pnpm build`). */
export function packPublished(options: PackOptions): readonly Packed[] {
  const pack = options.pack ?? pnpmPack
  const readPackedManifest = options.readPackedManifest ?? tarManifest
  const published = [...publishablePackages(options.root)].sort((a, b) =>
    a.manifest.name.localeCompare(b.manifest.name),
  )
  for (const pkg of published)
    if (!existsSync(join(options.root, pkg.dir, 'dist')))
      throw new Error(`${pkg.dir}/dist is missing: run pnpm build first`)
  prepare(options.out)
  return published.map((pkg) => {
    const file = pack(join(options.root, pkg.dir), options.out)
    const packed = readPackedManifest(join(options.out, file))
    for (const field of FIELDS)
      for (const [name, range] of Object.entries(packed[field] ?? {}))
        if (range.startsWith('workspace:'))
          throw new Error(`${pkg.manifest.name} has a workspace: range after packing: ${name} ${range}`)
    return { name: pkg.manifest.name, file }
  })
}
