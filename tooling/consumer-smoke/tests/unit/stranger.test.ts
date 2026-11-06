import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { overridesYaml, packOverrides, strangerFolder } from '#src/stranger.ts'

describe('packOverrides', () => {
  it('names each pack by the absolute file: path of its tarball', () => {
    const overrides = packOverrides('/work', [
      { name: '@mcthaydt/automata-tools', tarball: 'packs/tools.tgz' },
      { name: '@mcthaydt/automata', tarball: 'packs/automata.tgz' },
    ])
    expect(overrides).toEqual({
      '@mcthaydt/automata': 'file:/work/packs/automata.tgz',
      '@mcthaydt/automata-tools': 'file:/work/packs/tools.tgz',
    })
  })

  it('refuses a package that was not packed', () => {
    expect(() => packOverrides('/work', [{ name: '@mcthaydt/automata' }])).toThrow(/no packed tarball/)
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
    expect(folder.startsWith(base)).toBe(true)
  })

  it('refuses a base inside a pnpm workspace, where the game would resolve the repository', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'af-stranger-ws-'))
    writeFileSync(join(workspace, 'pnpm-workspace.yaml'), 'packages: []\n')
    const inside = join(workspace, 'deep', 'er')
    mkdirSync(inside, { recursive: true })
    expect(() => strangerFolder(inside)).toThrow(/inside a pnpm workspace/)
  })
})
