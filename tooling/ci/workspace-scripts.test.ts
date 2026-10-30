import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { plusManifests } from '../core/manifest-rules.ts'

// PRODUCT.5f: what `pnpm check` runs once Plus has packages. A Plus extension's sim is held to the framework's sim
// rules by the same checker the framework runs on its own sims (`automata-check-boundaries <roots>`), so every
// package that declares sim entries a game may import (`automata.simEntries`, P5-D2) has its `src` on the root
// `boundaries` run. `check` runs that, and each package's own typecheck and Node tests; the browser parity
// projects are separate (`test:parity`), as in the framework.

const root = fileURLToPath(new URL('../..', import.meta.url))
const scripts = (
  JSON.parse(readFileSync(`${root}package.json`, 'utf8')) as { scripts: Record<string, string> }
).scripts

interface SimPackage {
  readonly dir: string
  readonly manifest: Record<string, unknown>
}

const simPackages: SimPackage[] = plusManifests(root)
  .filter(({ manifest }) => {
    const automata = manifest.automata as { simEntries?: unknown } | undefined
    return Array.isArray(automata?.simEntries)
  })
  .map(({ path, manifest }) => ({ dir: path.replace(/\/package\.json$/, ''), manifest }))

/** The folder each declared sim entry's source file is in: `packages/net/src/sim` for `./sim`. */
const simEntryFolders = ({ dir, manifest }: SimPackage): string[] => {
  const exports = manifest.exports as Record<string, string>
  return ((manifest.automata as { simEntries: string[] }).simEntries ?? []).map((entry) => {
    const target = exports[entry]
    if (typeof target !== 'string') throw new Error(`${dir}: sim entry ${entry} is not in exports`)
    return `${dir}/${target.replace(/^\.\//, '').replace(/\/[^/]+$/, '')}`
  })
}

/** Each starter's sim folder (`starters/<name>/src/sim`) that exists on disk. */
const starterSimFolders: string[] = existsSync(`${root}starters`)
  ? readdirSync(`${root}starters`, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(`${root}starters/${entry.name}/src/sim`))
      .map((entry) => `starters/${entry.name}/src/sim`)
      .sort()
  : []

describe('the root scripts', () => {
  it('has at least one package with sim entries to check', () => {
    expect(simPackages.map(({ dir }) => dir)).toContain('packages/physics')
  })

  it('runs the boundaries checker over the folder of every declared sim entry', () => {
    const [bin, ...roots] = (scripts.boundaries ?? '').split(/\s+/)
    expect(bin).toBe('automata-check-boundaries')
    for (const pkg of simPackages)
      for (const folder of simEntryFolders(pkg))
        expect(
          roots.some((root) => folder === root || folder.startsWith(`${root}/`)),
          `${folder} is not under a boundaries root`,
        ).toBe(true)
  })

  // PRODUCT.8b: a starter's sim exports no entry, but it is a sim all the same, so every `starters/*/src/sim` folder
  // is on the run.
  it('runs the boundaries checker over every starter sim folder', () => {
    const roots = (scripts.boundaries ?? '').split(/\s+/).slice(1)
    expect(starterSimFolders.length).toBeGreaterThan(0)
    for (const folder of starterSimFolders)
      expect(roots, `${folder} is not a boundaries root`).toContain(folder)
  })

  it('makes check run lint, typecheck, boundaries and the tests', () => {
    expect(scripts.check?.split(' && ')).toEqual([
      'pnpm lint',
      'pnpm typecheck',
      'pnpm boundaries',
      'pnpm test',
    ])
  })

  it('makes typecheck and test reach every package', () => {
    expect(scripts.typecheck).toBe('tsc -p . && pnpm -r --if-present typecheck')
    expect(scripts.test).toBe('vitest run && pnpm -r --if-present test:unit')
    expect(scripts['test:parity']).toBe('pnpm -r --if-present test:parity')
  })
})
