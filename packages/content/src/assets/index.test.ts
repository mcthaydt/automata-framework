import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as assets from './index'

// `@mcthaydt/automata-content/assets` (M5.6): the atlas build, on its own entry so `pngjs` stays out of any
// browser graph that imports the content package's root.
describe('the assets entry', () => {
  it('exports the atlas build and the packer', () => {
    expect(Object.keys(assets).sort()).toEqual([
      'ATLAS_EXTRUDE',
      'ATLAS_PADDING',
      'ATLAS_PAGE_MAX',
      'AtlasFrameTooLarge',
      'buildAtlases',
      'packFrames',
    ])
  })

  it('is a subpath of the package, in the workspace and when published', () => {
    const manifest = JSON.parse(readFileSync(join(import.meta.dirname, '../../package.json'), 'utf8'))
    expect(manifest.exports['./assets']).toBe('./src/assets/index.ts')
    expect(manifest.publishConfig.exports['./assets']).toEqual({
      types: './dist/assets.d.ts',
      import: './dist/assets.js',
    })
  })

  it('is not reachable from the root entry', () => {
    const root = readFileSync(join(import.meta.dirname, '../index.ts'), 'utf8')
    expect(root).not.toMatch(/from '\.\/assets/)
  })
})
