import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { workspacePackages } from '#src/publishable-packages.ts'

// FR.1 (Plus TR-D3): a private package whose built code a binary must load builds to `dist` like the published
// packages, so `pnpm pack` (which applies `publishConfig.exports`) hands Plus a pack that exports built code, not
// TypeScript source. It stays private: nothing here makes it publishable (release-list.test.ts pins what is). None
// exists today: the sector format was the one, until it became `@automata/3d/level` (the 3D slice, task 2.1); Plus's
// catch-up decides whether the 3D package builds `dist` (automata-plus #40, P-D4). Any that returns is checked here.
const root = fileURLToPath(new URL('../../../..', import.meta.url))

// Libraries only: the private cli also builds to dist, but it is a binary with its own checks.
const builtPrivate = workspacePackages(root).filter(
  (pkg) =>
    pkg.manifest.private === true &&
    pkg.manifest.publishConfig?.exports !== undefined &&
    pkg.manifest.bin === undefined,
)

/** Every file path a conditional export points at. */
function targets(entry: unknown): string[] {
  if (typeof entry === 'string') return [entry]
  if (entry !== null && typeof entry === 'object') return Object.values(entry).flatMap(targets)
  return []
}

describe('private packages that ship built code', () => {
  it('ship dist, with the export keys of the workspace pointing into it', () => {
    for (const { manifest } of builtPrivate) {
      expect(manifest.files, manifest.name).toContain('dist')
      expect(Object.keys(manifest.publishConfig?.exports ?? {}), manifest.name).toEqual(
        Object.keys(manifest.exports ?? {}),
      )
      for (const target of Object.values(manifest.publishConfig?.exports ?? {}).flatMap(targets))
        expect(target, manifest.name).toMatch(/^\.\/dist\//)
      expect(manifest.publishConfig?.registry, `${manifest.name} must not name a registry`).toBeUndefined()
    }
  })
})

// After `pnpm build` (`pnpm --filter @automata/release test:dist`, run by CI's checks job); skipped by `pnpm check`, which does not build.
describe.skipIf(process.env.AF_CHECK_DIST !== '1')('the built private packages', () => {
  it('have every file publishConfig names', () => {
    for (const { dir, manifest } of builtPrivate) {
      const named = Object.values(manifest.publishConfig?.exports ?? {}).flatMap(targets)
      expect(
        named.filter((file) => !existsSync(join(root, dir, file))),
        manifest.name,
      ).toEqual([])
    }
  })

  it('load: every built entry imports and exports something (TR-D3)', async () => {
    for (const { dir, manifest } of builtPrivate) {
      for (const [key, entry] of Object.entries(manifest.publishConfig?.exports ?? {})) {
        const file = targets(entry).find((target) => target.endsWith('.js'))
        if (file === undefined) throw new Error(`${manifest.name} ${key} names no .js file`)
        const loaded = await import(pathToFileURL(join(root, dir, file)).href)
        expect(Object.keys(loaded).length, `${manifest.name} ${key}`).toBeGreaterThan(0)
      }
    }
  })
})
