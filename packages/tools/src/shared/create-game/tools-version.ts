import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The version of this package, which every published framework package shares (one changesets `fixed` group), so a
 * new game asks for exactly the packages that made it. Found by walking up from this file to the package's own
 * `package.json`: the folder differs between the source (`src/shared/create-game/`) and the built bin (`dist/`).
 */
export function toolsVersion(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (;;) {
    try {
      const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
        name?: string
        version?: string
      }
      if (manifest.name === '@mcthaydt/automata-tools' && manifest.version !== undefined) {
        return manifest.version
      }
    } catch {
      // No package.json in this folder: keep walking up.
    }
    const parent = dirname(dir)
    if (parent === dir) throw new Error("Couldn't find the tools package's own package.json.")
    dir = parent
  }
}
