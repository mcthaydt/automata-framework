import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The kit's own promises: every file `kit.json` names exists, and every file lands in a game's `src/screens/`.

const KIT = dirname(dirname(fileURLToPath(import.meta.url)))
const manifestJson: unknown = JSON.parse(readFileSync(join(KIT, 'kit.json'), 'utf8'))

describe('kit.json', () => {
  const files = (manifestJson as { files: { from: string; to: string }[] }).files

  it('names the kit and a core range', () => {
    const manifest = manifestJson as { name: string; requires: { core: string } }
    expect(manifest.name).toBe('ui-screens')
    expect(manifest.requires.core).toMatch(/^>=0\.0\.4/)
  })

  it('copies only files that exist', () => {
    expect(files.filter((f) => !existsSync(join(KIT, f.from))).map((f) => f.from)).toEqual([])
  })

  it('puts every file in the game under src/screens/', () => {
    expect(files.filter((f) => !f.to.startsWith('src/screens/')).map((f) => f.to)).toEqual([])
  })

  it('copies only what a game needs: no tests, no testing folder', () => {
    expect(files.filter((f) => /\.test\.|\/testing\//.test(f.from)).map((f) => f.from)).toEqual([])
  })
})
