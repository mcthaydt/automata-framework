import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

// PRODUCT.6: `kit.json` is read by `automata add`, so it is checked by the CLI's own schema (one contract owner), read from the
// framework checkout at core.ref (.core/af), never copied here. Then the kit's own promises: every file it names exists, and every
// file lands in the game's `src/screens/`.

const KIT = dirname(dirname(fileURLToPath(import.meta.url)))
const AF = join(KIT, '..', '..', '.core', 'af')
const manifestJson: unknown = JSON.parse(readFileSync(join(KIT, 'kit.json'), 'utf8'))

async function cliSchema(): Promise<{
  safeParse(value: unknown): { success: boolean; data?: unknown; error?: { issues: { message: string }[] } }
}> {
  const file = join(AF, 'packages', 'cli', 'src', 'add', 'kit-manifest.schema.ts')
  const loaded: { kitManifestSchema: never } = await import(pathToFileURL(file).href)
  return loaded.kitManifestSchema
}

describe('kit.json', () => {
  it('passes the CLI schema that automata add reads it with', async () => {
    const result = (await cliSchema()).safeParse(manifestJson)
    expect(result.success ? [] : result.error?.issues.map((i) => i.message)).toEqual([])
  })

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
