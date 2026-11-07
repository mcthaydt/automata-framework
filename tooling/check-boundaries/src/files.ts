import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Every module kind TypeScript or Node can load. Checking only `.ts` let `.mts`/`.cts` files slip past
// the checker (audit, 2026-10-11).
const SOURCE = /\.(?:[cm]?ts|tsx|[cm]?js|jsx)$/
const SKIPPED = /\.(?:test|spec)\.[cm]?[jt]sx?$|\.d\.[cm]?ts$/
// Installed packages and build output are never sources (a folder walk in inline mode starts at examples/).
const SKIPPED_DIRS: ReadonlySet<string> = new Set(['node_modules', 'dist'])

/** True for a file the checker reads: a module of any kind, but not a test or a type declaration. */
export function isSourceFile(name: string): boolean {
  return SOURCE.test(name) && !SKIPPED.test(name)
}

/**
 * All checkable source files under `dir`, sorted, skipping tests and type declarations, and any folder named in
 * `skipDirs` (`--skip-dir`: `packages/sim/src/testing` holds Vitest helpers that are not sim code).
 */
export function collectSources(dir: string, skipDirs: readonly string[] = []): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (!SKIPPED_DIRS.has(name) && !skipDirs.includes(name)) out.push(...collectSources(path, skipDirs))
    } else if (isSourceFile(name)) out.push(path)
  }
  return out
}

/**
 * The roles whose files are the sim in a game laid out by role (GL spec §4.5). The `automata check` step
 * (packages/cli) and the plugin hook (agents/automata/scripts/check.mjs) keep copies of this list, because this
 * package is a bin with no library entry; their tests pin the same names.
 */
export const GAME_SIM_ROLES: readonly string[] = [
  'constants',
  'components',
  'commands',
  'events',
  'resources',
  'systems',
  'state',
]

/** The names a game's sim set is made of, for messages: `constants, …, state, sim.ts`. */
export const GAME_SIM_SET_NAMES: string = `${GAME_SIM_ROLES.join(', ')}, sim.ts`

/**
 * A game's sim set (GL spec §4.5): each role as `<role>.ts` or every source under `<role>/`, plus `sim.ts`. Closed
 * on purpose: a sim helper lives in the role file that uses it, so the boundary shows in the file names.
 */
export function collectGameSimSet(src: string): string[] {
  const out: string[] = []
  for (const name of [...GAME_SIM_ROLES, 'sim']) {
    const file = join(src, `${name}.ts`)
    if (existsSync(file)) out.push(file)
    const folder = join(src, name)
    if (name !== 'sim' && existsSync(folder) && statSync(folder).isDirectory())
      out.push(...collectSources(folder))
  }
  return out.sort()
}
