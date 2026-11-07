import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Which `@automata/*` packages a folder of agent text names, so a test can require that every one is published.

const EXTENSIONS = ['.md', '.ts', '.mjs', '.json']
const PACKAGE = /@automata\/[a-z0-9-]+/g

/**
 * Each `@automata/<name>` named in a `.md`, `.ts`, `.mjs` or `.json` file below `dir`, with the files naming it
 * (slash paths relative to `dir`, sorted). A subpath such as `@automata/sim/math` counts as its package.
 */
export function packageNamesIn(dir: string): Map<string, string[]> {
  const found = new Map<string, Set<string>>()
  const walk = (prefix: string) => {
    for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true })) {
      const path = prefix === '' ? entry.name : `${prefix}/${entry.name}`
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') walk(path)
      } else if (EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
        for (const [name] of readFileSync(join(dir, path), 'utf8').matchAll(PACKAGE)) {
          found.set(name, (found.get(name) ?? new Set()).add(path))
        }
      }
    }
  }
  walk('')
  return new Map(
    [...found].sort(([a], [b]) => (a < b ? -1 : 1)).map(([name, files]) => [name, [...files].sort()]),
  )
}
