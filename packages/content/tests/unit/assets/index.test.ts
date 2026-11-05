import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as assets from '#src/features/assets/index.ts'

// `@mcthaydt/automata-content/assets` (M5.6, M5.5): the atlas and font builds, on their own entry so `pngjs`,
// `subset-font` and `fontkit` stay out of any browser graph that imports the content package's root.
describe('the assets entry', () => {
  it('exports the atlas build, the packer, the font build and its subset and coverage functions', () => {
    expect(Object.keys(assets).sort()).toEqual([
      'ATLAS_EXTRUDE',
      'ATLAS_PADDING',
      'ATLAS_PAGE_MAX',
      'AtlasFrameTooLarge',
      'buildAtlases',
      'buildFonts',
      'fontCoverage',
      'packFrames',
      'subsetWoff2',
    ])
  })

  it('is a subpath of the package, in the workspace and when published', () => {
    const manifest = JSON.parse(readFileSync(join(import.meta.dirname, '../../../package.json'), 'utf8'))
    expect(manifest.exports['./assets']).toBe('./src/entries/assets.ts')
    expect(manifest.publishConfig.exports['./assets']).toEqual({
      types: './dist/assets.d.ts',
      import: './dist/assets.js',
    })
  })

  it('is not reachable from the root entry', () => {
    const root = readFileSync(join(import.meta.dirname, '../../../src/entries/index.ts'), 'utf8')
    expect(root).not.toMatch(/from '\.\/assets/)
  })
})
