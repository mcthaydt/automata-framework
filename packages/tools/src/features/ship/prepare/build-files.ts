import { readdirSync, realpathSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/**
 * Every file under `dir`, in name order, following symlinked folders once each (a link back up would loop
 * forever). A dangling symlink points at nothing a browser could load, so it is skipped. Moved here from
 * `root-absolute.ts` so the itch.io checks read the same files.
 */
export function walk(dir: string, seen: Set<string> = new Set<string>()): string[] {
  const real = realpathSync(dir)
  if (seen.has(real)) return []
  seen.add(real)
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name)
      const stats = statSync(path, { throwIfNoEntry: false })
      if (stats === undefined) return []
      return stats.isDirectory() ? walk(path, seen) : [path]
    })
}

/** The build's files as `/`-separated paths relative to `distDir`, sorted by code unit (not locale). */
export function buildFiles(distDir: string): string[] {
  return walk(distDir)
    .map((path) => relative(distDir, path).split(sep).join('/'))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}
