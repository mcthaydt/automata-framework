import { describe, expect, it } from 'vitest'
import { findRanges, pinsFromManifests, pinsFromVersionsDoc, publishedPeerFloors } from './pins.ts'

describe('pinsFromVersionsDoc', () => {
  it('reads the npm packages table and ignores the other tables', () => {
    const doc = [
      '# Pinned versions',
      '## Runtimes',
      '| Tool | Version | Date | Why |',
      '| Node | 24.21.0 | 2026-10-11 | Ruken R-20 |',
      '## npm packages',
      '| Package | Version | Date | Why |',
      '|---|---|---|---|',
      '| `zod` | 4.6.5 | 2026-10-11 | schemas |',
      '| `@types/node` | 24.19.1 | 2026-10-11 | Node 24 types |',
      '## Container images',
      '| `mcr.microsoft.com/playwright` | v1.63.0-noble | 2026-10-11 | parity job |',
    ].join('\n')
    expect(pinsFromVersionsDoc(doc)).toEqual([
      { name: 'zod', version: '4.6.5' },
      { name: '@types/node', version: '24.19.1' },
    ])
  })

  it('returns nothing when the npm packages table is missing', () => {
    expect(pinsFromVersionsDoc('# Pinned versions\n## Runtimes\n')).toEqual([])
  })
})

describe('pinsFromManifests', () => {
  it('collects external pins once, sorted, and skips workspace and file dependencies', () => {
    expect(
      pinsFromManifests([
        { dependencies: { zod: '4.6.5', '@mcthaydt/automata-sim': 'workspace:*' } },
        {
          devDependencies: { zod: '4.6.5', vitest: '5.0.3' },
          dependencies: { '@ruken/manifest': 'file:../../vendor/ruken/ruken-manifest-0.0.0.tgz' },
        },
      ]),
    ).toEqual([
      { name: 'vitest', version: '5.0.3' },
      { name: 'zod', version: '4.6.5' },
    ])
  })
})

describe('findRanges', () => {
  it('reports every specifier that is not an exact version', () => {
    expect(
      findRanges([
        { name: 'a', version: '^1.0.0' },
        { name: 'b', version: '~1.0.0' },
        { name: 'c', version: '*' },
        { name: 'd', version: '>=1' },
        { name: 'e', version: '1.x' },
        { name: 'f', version: '1.2.3' },
        { name: 'g', version: '0.1.0-beta.2' },
      ]).map((pin) => pin.name),
    ).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
})

describe('publishedPeerFloors', () => {
  const published = {
    publishConfig: { registry: 'https://npm.pkg.github.com' },
    peerDependencies: { svelte: '^5.57.1', '@mcthaydt/automata-testing': 'workspace:*' },
    devDependencies: { svelte: '5.57.1', vitest: '^5.0.3' },
  }

  it("reads a published package's caret peers as their floor, so a game's patch release still satisfies them", () => {
    expect(publishedPeerFloors(published).peerDependencies).toEqual({
      svelte: '5.57.1',
      '@mcthaydt/automata-testing': 'workspace:*',
    })
  })

  it('leaves every other range a range: in devDependencies, and in a private or unpublished package', () => {
    expect(findRanges(pinsFromManifests([publishedPeerFloors(published)])).map((pin) => pin.name)).toEqual([
      'vitest',
    ])
    for (const manifest of [{ ...published, private: true }, { peerDependencies: { svelte: '^5.57.1' } }]) {
      expect(publishedPeerFloors(manifest).peerDependencies).toEqual(manifest.peerDependencies)
    }
  })

  it('keeps a peer range that is not a plain caret on an exact version', () => {
    const loose = { ...published, peerDependencies: { svelte: '^5', vite: '>=8.3.2' } }
    expect(publishedPeerFloors(loose).peerDependencies).toEqual({ svelte: '^5', vite: '>=8.3.2' })
  })
})
