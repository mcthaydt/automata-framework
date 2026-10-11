import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Every module kind TypeScript or Node can load. Checking only `.ts` let `.mts`/`.cts` files slip past
// the checker (audit, 2026-10-11).
const SOURCE = /\.(?:[cm]?ts|tsx|[cm]?js|jsx)$/
const SKIPPED = /\.(?:test|spec)\.[cm]?[jt]sx?$|\.d\.[cm]?ts$/

/** All checkable source files under `dir`, sorted, skipping tests and type declarations. */
export function collectSources(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...collectSources(path))
    else if (SOURCE.test(name) && !SKIPPED.test(name)) out.push(path)
  }
  return out
}
