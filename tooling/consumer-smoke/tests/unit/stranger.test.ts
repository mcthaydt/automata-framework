import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { overridesYaml, packOverrides, strangerFolder } from '#src/stranger.ts'

describe('packOverrides', () => {
  it('names each pack by the absolute file: path of its tarball', () => {
    const overrides = packOverrides('/work', [
      { name: '@automata/tools', tarball: 'packs/tools.tgz' },
      { name: '@automata/framework', tarball: 'packs/automata.tgz' },
    ])
    expect(overrides).toEqual({
      '@automata/framework': 'file:/work/packs/automata.tgz',
      '@automata/tools': 'file:/work/packs/tools.tgz',
    })
  })

  it('refuses a package that was not packed', () => {
    expect(() => packOverrides('/work', [{ name: '@automata/framework' }])).toThrow(/no packed tarball/)
  })
})

describe('overridesYaml', () => {
  it('writes the overrides pnpm reads from pnpm-workspace.yaml, in name order', () => {
    expect(overridesYaml({ b: 'file:/b.tgz', a: 'file:/a.tgz' })).toBe(
      "overrides:\n  'a': 'file:/a.tgz'\n  'b': 'file:/b.tgz'\n",
    )
  })
})

describe('strangerFolder', () => {
  it('makes a new empty folder under the given base', () => {
    const base = mkdtempSync(join(tmpdir(), 'af-stranger-test-'))
    const folder = strangerFolder(base)
    // The folder is a real path, and macOS's tmpdir is a symlink (/var -> /private/var), so compare real paths.
    expect(folder.startsWith(realpathSync(base))).toBe(true)
  })

  it('refuses a base inside a pnpm workspace, where the game would resolve the repository', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'af-stranger-ws-'))
    writeFileSync(join(workspace, 'pnpm-workspace.yaml'), 'packages: []\n')
    const inside = join(workspace, 'deep', 'er')
    mkdirSync(inside, { recursive: true })
    expect(() => strangerFolder(inside)).toThrow(/inside a pnpm workspace/)
  })
})
