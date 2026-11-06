import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { publishedBuild } from '#src/tsdown-shared.ts'

/** A package folder with this package.json; returns the `import.meta.url` its `tsdown.config.ts` would have. */
function packageWith(manifest: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), 'af-tsdown-shared-'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest))
  return pathToFileURL(join(dir, 'tsdown.config.ts')).href
}

const matchesAny = (patterns: unknown, id: string): boolean =>
  Array.isArray(patterns) && patterns.some((pattern) => pattern instanceof RegExp && pattern.test(id))

const manifest = {
  name: '@mcthaydt/automata-runtime',
  dependencies: { effect: '3.22.2' },
  peerDependencies: { svelte: '^5.57.1' },
  devDependencies: { '@ruken/manifest': 'file:x.tgz', '@ruken/sdk-host': 'file:y.tgz' },
}

describe('publishedBuild', () => {
  it('bundles each entry by default, keeping dependencies and peers external', () => {
    const config = publishedBuild(packageWith(manifest), {
      entry: { index: 'src/index.ts' },
      platform: 'browser',
    })
    expect(config.unbundle).toBeUndefined()
    expect(matchesAny(config.deps?.onlyImport, 'effect')).toBe(true)
    expect(matchesAny(config.deps?.onlyImport, 'svelte/internal')).toBe(true)
    expect(matchesAny(config.deps?.onlyImport, '@ruken/manifest')).toBe(false)
  })

  // DX.2a: runtime's `.svelte.ts` rune modules must reach a game as files of their own (DX2A-1).
  it('mirrors the source tree when asked to unbundle', () => {
    const config = publishedBuild(packageWith(manifest), {
      entry: { index: 'src/index.ts' },
      platform: 'browser',
      unbundle: true,
    })
    expect(config.unbundle).toBe(true)
  })

  // DX.2a: runtime imports Ruken types only. Kept as imports here, they are inlined into dist/vendor by the
  // declarations pass (`tsdown.dts.config.ts`) and pointed at by finishSvelteDist (DX2A-2).
  it('keeps types-only Ruken packages out of the bundle and lets the declarations import them', () => {
    const config = publishedBuild(packageWith(manifest), {
      entry: { index: 'src/index.ts' },
      platform: 'browser',
      rukenTypes: ['@ruken/manifest', '@ruken/sdk-host'],
    })
    for (const id of ['@ruken/manifest', '@ruken/sdk-host/testing']) {
      expect(matchesAny(config.deps?.neverBundle, id), id).toBe(true)
      expect(matchesAny(config.deps?.onlyImport, id), id).toBe(true)
    }
    expect(matchesAny(config.deps?.onlyImport, '@ruken/sdk')).toBe(false)
    expect(config.deps?.onlyBundle).toEqual([])
  })
})
