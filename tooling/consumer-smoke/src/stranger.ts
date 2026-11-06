// The helpers behind the stranger's journey (tests/e2e/stranger.test.ts): a person with an empty folder and nothing
// from this repository but what it publishes. They make the folder, say where the packs are, and nothing else, so the
// journey meets what a stranger meets.
import { existsSync, mkdtempSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import type { ConsumerPackage } from './project.ts'

/**
 * Where each published package name should come from instead of a registry: its tarball, by absolute `file:` path.
 * The packs are not on any registry yet, and the game a stranger makes asks for `^<version>` of each; this stands
 * in for the registry, nothing else about the game is changed.
 */
export function packOverrides(project: string, packs: readonly ConsumerPackage[]): Record<string, string> {
  const overrides: Record<string, string> = {}
  for (const pack of packs) {
    if (pack.tarball === undefined) throw new Error(`no packed tarball for ${pack.name}`)
    // `tarball` is relative to the project folder (`packs/<file>`).
    overrides[pack.name] = `file:${resolve(project, pack.tarball)}`
  }
  return Object.fromEntries(Object.entries(overrides).sort(([a], [b]) => a.localeCompare(b)))
}

/** The `pnpm-workspace.yaml` that holds the overrides (newer pnpm no longer reads them from `package.json`). */
export function overridesYaml(overrides: Readonly<Record<string, string>>): string {
  const lines = Object.entries(overrides)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, spec]) => `  '${name}': '${spec}'`)
  return ['overrides:', ...lines, ''].join('\n')
}

/** The folder above `dir` (or `dir` itself) that holds a `pnpm-workspace.yaml`, if any. */
function enclosingWorkspace(dir: string): string | undefined {
  let current = resolve(dir)
  for (;;) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) return current
    const parent = dirname(current)
    if (parent === current) return undefined
    current = parent
  }
}

/**
 * A new empty folder for the stranger's work. It must not sit inside a pnpm workspace: there, `pnpm install` would
 * link the repository's own packages and the journey would pass without the packs ever being used.
 */
export function strangerFolder(base: string = tmpdir()): string {
  const workspace = enclosingWorkspace(base)
  if (workspace !== undefined) {
    throw new Error(`${base} is inside a pnpm workspace (${workspace}); a stranger's folder cannot be.`)
  }
  return realpathSync(mkdtempSync(join(base, 'af-stranger-')))
}
