import { readFileSync } from 'node:fs'
import { collectSources, isSourceFile } from './files.ts'
import { readImports, resolveRelative } from './imports.ts'

// A game laid out by feature (core and 2D refactor spec §3.3) has no `systems.ts` to point at: its sim is every file
// whose name ends in a role suffix, wherever it sits, and every file such a file imports by relative path. A helper
// that a system imports (a tuning table, a tile map) is sim code even though its name says nothing, and a file no sim
// file imports (a HUD view) is not.

/** The suffixes that make a file a sim file (AGENTS.md, Naming): the sim's own role files. */
export const SIM_SUFFIXES: readonly string[] = [
  '.component.ts',
  '.system.ts',
  '.command.ts',
  '.event.ts',
  '.resource.ts',
  '.plugin.ts',
]

/**
 * The sim files under a game's `src/`, sorted: the files with a role suffix, plus the closure of their relative value
 * imports. A type-only import brings no code, so it pulls nothing in, and neither does a file that is not code (a
 * JSON table: the import check reports it). Tests are never sim files.
 */
export function collectSimBySuffix(src: string): string[] {
  const found = new Set(
    collectSources(src).filter((file) => SIM_SUFFIXES.some((suffix) => file.endsWith(suffix))),
  )
  const queue = [...found]
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    for (const { specifier, typeOnly } of readImports(next, readFileSync(next, 'utf8')).imports) {
      if (typeOnly || !specifier.startsWith('.')) continue
      const target = resolveRelative(next, specifier)
      if (target === undefined || !isSourceFile(target) || found.has(target)) continue
      found.add(target)
      queue.push(target)
    }
  }
  return [...found].sort()
}
