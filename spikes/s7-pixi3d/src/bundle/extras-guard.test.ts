// Run with `node --test src/bundle/extras-guard.test.ts` after `vite build` (measure.ts builds first). The scene's
// build passes; the extras page's build fails, minified, which is the case the name alone would miss.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { build } from 'vite'
import { assertNoExtras, findExtras } from './extras-guard.ts'

const here = join(import.meta.dirname, '../..')

async function buildPage(entry: string): Promise<string> {
  const outDir = mkdtempSync(join(tmpdir(), 's7-guard-'))
  await build({
    root: here,
    configFile: join(here, 'vite.config.ts'),
    logLevel: 'silent',
    build: { outDir, emptyOutDir: true, manifest: false, rollupOptions: { input: join(here, entry) } },
  })
  return outDir
}

describe('assertNoExtras', () => {
  it('passes the S7 scene build, which imports only the main entry', async () => {
    const dir = await buildPage('index.html')
    try {
      assert.doesNotThrow(() => assertNoExtras(dir))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('fails a minified build that imports @pixi/3d/extras, though the name generateSpawnBurst is gone', async () => {
    const dir = await buildPage('extras.html')
    try {
      const hits = findExtras(dir)
      assert.ok(hits.length > 0)
      assert.ok(hits.every((hit) => hit.marker !== 'generateSpawnBurst'))
      assert.throws(() => assertNoExtras(dir), /@pixi\/3d\/extras is in the bundle/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('fails an unminified build by the name', () => {
    const dir = mkdtempSync(join(tmpdir(), 's7-guard-'))
    try {
      writeFileSync(join(dir, 'game.js'), 'function generateSpawnBurst() {}\n')
      assert.throws(() => assertNoExtras(dir), /generateSpawnBurst/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
