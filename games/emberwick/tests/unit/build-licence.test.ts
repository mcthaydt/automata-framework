import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'vite'
import { describe, expect, it } from 'vitest'

// Emberwick draws its words in a pixel font cut into one subset per language. The font's licence (the SIL Open Font
// License, which asks that its text travel with the font) is written beside the subsets by the font build, so a built
// game must carry it too: every language's font with it, next to the faces.

const root = join(import.meta.dirname, '../..')

describe('the built game', () => {
  it('carries each font’s licence text next to the font subsets', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'emberwick-build-'))
    try {
      await build({
        root,
        configFile: join(root, 'vite.config.ts'),
        configLoader: 'runner',
        logLevel: 'silent',
        build: { outDir, emptyOutDir: true, write: true },
      })
      const assets = readdirSync(join(outDir, 'assets'))
      expect(assets.filter((file) => file.endsWith('.woff2')).length).toBeGreaterThanOrEqual(6)
      const licences = assets.filter((file) => file.endsWith('-OFL.txt')).sort()
      expect(licences).toEqual(['ja-OFL.txt', 'ko-OFL.txt', 'zh-hans-OFL.txt'])
      for (const file of licences) {
        expect(readFileSync(join(outDir, 'assets', file), 'utf8')).toContain('SIL OPEN FONT LICENSE')
      }
    } finally {
      rmSync(outDir, { recursive: true, force: true })
    }
  }, 240_000)
})
