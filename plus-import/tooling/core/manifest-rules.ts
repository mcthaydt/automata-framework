import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface PlusManifest {
  /** The manifest's path from the Plus root, for messages: `packages/physics/package.json`. */
  readonly path: string
  readonly manifest: Record<string, unknown>
}

/** Every `packages/*\/package.json` and `kits/*\/package.json` in the Plus workspace: packages first, each in folder order. */
export function plusManifests(root: string): PlusManifest[] {
  return ['packages', 'kits'].flatMap((group) => {
    const dir = join(root, group)
    if (!existsSync(dir)) return []
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, 'package.json')))
      .map((entry) => entry.name)
      .sort()
      .map((folder) => {
        const path = `${group}/${folder}/package.json`
        return {
          path,
          manifest: JSON.parse(readFileSync(join(root, path), 'utf8')) as Record<string, unknown>,
        }
      })
  })
}

/** The names of the packages Plus has itself: core never overrides them (the framework packs physics until 5g). */
export function plusPackageNames(root: string): Set<string> {
  return new Set(
    plusManifests(root).flatMap(({ manifest }) => (typeof manifest.name === 'string' ? [manifest.name] : [])),
  )
}

// The manifest rules of a Plus package (PRODUCT.5e, test 5).
//
// The license: Plus is MIT, like the framework (the Owner, 2026-11-01: "MIT"; this replaces P5-D5's commercial
// notice). Only the editor apps on iOS and Android are paid, and their wrapper code lives in a separate private
// repository.
//
// Core is a peer: a game installs core itself, and a Plus package that depended on its own copy would put two
// sims (two Kootas) in one install tree. devDependencies may list core for Plus's own tests; until core is on a
// registry they resolve through the overrides block (P5-D1). Every @mcthaydt name that is not a Plus package is
// core, the framework's private evidence pack included.

export const PLUS_LICENSE = 'MIT'
const CORE_SCOPE = '@mcthaydt/'
const NOT_FOR_CORE = ['dependencies', 'optionalDependencies'] as const

export function manifestProblems(
  path: string,
  manifest: Record<string, unknown>,
  plusNames: ReadonlySet<string>,
): string[] {
  const problems: string[] = []
  if (manifest.license !== PLUS_LICENSE)
    problems.push(`${path}: "license" must be "${PLUS_LICENSE}"; found ${JSON.stringify(manifest.license)}`)
  for (const field of NOT_FOR_CORE) {
    const map = manifest[field]
    if (map === undefined) continue
    if (typeof map !== 'object' || map === null || Array.isArray(map)) {
      problems.push(`${path}: "${field}" must be an object of names and ranges`)
      continue
    }
    for (const name of Object.keys(map).sort()) {
      if (name.startsWith(CORE_SCOPE) && !plusNames.has(name))
        problems.push(
          `${path}: ${name} is core; list it under peerDependencies (and devDependencies for tests), not ${field}`,
        )
    }
  }
  return problems
}

/** The problems of every manifest under packages/ and kits/. */
export function workspaceManifestProblems(root: string): string[] {
  const manifests = plusManifests(root)
  const names = plusPackageNames(root)
  return manifests.flatMap(({ path, manifest }) => manifestProblems(path, manifest, names))
}
