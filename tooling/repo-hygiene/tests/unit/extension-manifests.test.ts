import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extensionManifestProblems } from '#src/extension-manifests.ts'

// An extension is a workspace package under `extensions/`: its name follows its folder, it is MIT, it maps `#src`,
// and it reaches core only as a peer. The rule runs over the real folders and over small fixture trees.

const repoRoot = resolve(import.meta.dirname, '../../../..')

/** A temporary repository with one extension folder `x` whose manifest is the valid one plus `overrides`. */
function fixture(overrides: Record<string, unknown>): string {
  const root = mkdtempSync(join(tmpdir(), 'extension-manifests-'))
  mkdirSync(join(root, 'extensions/x'), { recursive: true })
  const manifest = {
    name: '@automata/x',
    version: '0.0.0',
    license: 'MIT',
    type: 'module',
    imports: { '#src/*': './src/*' },
    ...overrides,
  }
  writeFileSync(join(root, 'extensions/x/package.json'), JSON.stringify(manifest))
  return root
}

describe('extensionManifestProblems', () => {
  it('finds nothing wrong with the extensions in this repository', () => {
    expect(extensionManifestProblems(repoRoot)).toEqual([])
  })

  it('accepts a well-formed extension', () => {
    expect(extensionManifestProblems(fixture({}))).toEqual([])
  })

  it('refuses core in dependencies', () => {
    expect(extensionManifestProblems(fixture({ dependencies: { '@automata/sim': 'workspace:*' } }))).toEqual([
      'extensions/x/package.json: @automata/sim is core, so it belongs in peerDependencies',
    ])
  })

  it('refuses a name outside the @automata scope', () => {
    expect(extensionManifestProblems(fixture({ name: '@other-scope/x' }))[0]).toMatch(/@automata\/x/)
  })

  it('refuses a licence other than MIT and a missing #src map', () => {
    const problems = extensionManifestProblems(fixture({ license: 'UNLICENSED', imports: undefined }))
    expect(problems).toEqual([
      'extensions/x/package.json: license must be "MIT"',
      'extensions/x/package.json: imports must map "#src/*" to "./src/*"',
    ])
  })
})
