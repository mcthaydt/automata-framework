// S7-g and X-b against the real tarball: Vite's minified builds of two fixture pages, one shipping the 3D renderer
// through @pixi/3d's main entry and one importing `./extras`. ship's markers (packages/tools pixi3d-markers.ts) must
// find @pixi/3d in both and extras only in the second, after minification (S7 found a minifier can rename
// `generateSpawnBurst`, so the code generator's own strings are markers too).
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { build } from 'vite'
import { afterAll, describe, expect, it } from 'vitest'
// Read from the tools package's source, not through its package entry: tools builds the editor suite, which builds this
// package, so a dependency here would be a build cycle.
import { findPixi3d, PIXI3D_EXTRAS_MARKERS } from '../../../tools/src/features/ship/prepare/pixi3d-markers.ts'

const packageRoot = join(import.meta.dirname, '../..')
const built: string[] = []

async function buildPage(entry: string): Promise<string> {
  const outDir = mkdtempSync(join(tmpdir(), 'render-pixi3d-bundle-'))
  built.push(outDir)
  await build({
    root: packageRoot,
    configFile: false,
    logLevel: 'silent',
    plugins: [svelte()],
    build: {
      outDir,
      emptyOutDir: true,
      minify: true,
      rollupOptions: { input: join(import.meta.dirname, 'testing', entry) },
    },
  })
  return outDir
}

afterAll(() => {
  for (const dir of built) rmSync(dir, { recursive: true, force: true })
})

describe('a minified game bundle', () => {
  it('with the 3D renderer carries @pixi/3d (so a public prepare refuses it) and no extras', async () => {
    const found = findPixi3d(await buildPage('main-entry.ts'))
    expect(found.core.length).toBeGreaterThan(0)
    expect(found.extras).toEqual([])
  }, 120_000)

  it('importing @pixi/3d/extras is caught, by the code generator’s strings as well as the name', async () => {
    const dir = await buildPage('extras-entry.ts')
    expect(findPixi3d(dir).extras.length).toBeGreaterThan(0)
    const scripts = readdirSync(join(dir, 'assets'))
      .filter((name) => name.endsWith('.js'))
      .map((name) => readFileSync(join(dir, 'assets', name), 'utf8'))
      .join('\n')
    // The strings a minifier keeps, so the guard holds even where the name is renamed.
    for (const marker of PIXI3D_EXTRAS_MARKERS.filter((m) => m !== 'generateSpawnBurst'))
      expect(scripts, marker).toContain(marker)
  }, 120_000)
})
