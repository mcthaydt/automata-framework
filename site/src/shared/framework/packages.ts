import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { repositoryRoot } from './root.ts'

/** A package a game author can install, the API pages' list. */
export interface PublishedPackage {
  readonly name: string
  /** Its folder, from the repository root (`packages/sim`). */
  readonly dir: string
  readonly description: string
}

interface Manifest {
  readonly name: string
  readonly private?: boolean
  readonly description?: string
}

/** Every `packages/*` whose manifest is not private, by name: the same rule Changesets publishes by. */
export function publishedPackages(root: string = repositoryRoot): PublishedPackage[] {
  return readdirSync(join(root, 'packages'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const dir = `packages/${entry.name}`
      let manifest: Manifest
      try {
        manifest = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8')) as Manifest
      } catch {
        return []
      }
      if (manifest.private === true) return []
      return [{ name: manifest.name, dir, description: manifest.description ?? '' }]
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}
