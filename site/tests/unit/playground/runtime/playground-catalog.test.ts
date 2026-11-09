// @vitest-environment node

import type { CatalogEntry } from '@automataframework/examples-runner/catalog'
import { describe, expect, it } from 'vitest'
import { playgroundCatalog } from '../../../../playground/src/playground-catalog.ts'

const header = {
  name: 'shapes-rects',
  title: 'rectangles that move',
  shows: 'rect() draws one view per component id',
  controls: 'none',
  packages: ['@automataframework/automata'],
  difficulty: 1,
  tier: 'core',
  golden: 120,
  lines: 9,
} as const

const { golden: _golden, ...withoutGolden } = header

const entry = (overrides: Partial<CatalogEntry>): CatalogEntry => ({
  file: '/repo/examples/shapes/shapes-rects.ts',
  path: 'shapes/shapes-rects.ts',
  module: 'shapes',
  name: 'rects',
  id: 'shapes-rects',
  url: '/shapes/rects/',
  header,
  codeLines: 44,
  imports: ['@automataframework/automata'],
  problems: [],
  ...overrides,
})

describe('playgroundCatalog', () => {
  it("carries each example's header, its source as written, and where its frame page and module stand", () => {
    const [shapes] = playgroundCatalog([entry({})], () => 'export default 1\n')
    expect(shapes).toEqual({
      id: 'shapes-rects',
      module: 'shapes',
      name: 'rects',
      title: 'rectangles that move',
      shows: 'rect() draws one view per component id',
      controls: 'none',
      packages: ['@automataframework/automata'],
      difficulty: 1,
      tier: 'core',
      golden: { ticks: 120, replay: '/playground/goldens/shapes-rects.replay' },
      path: 'shapes/shapes-rects.ts',
      source: 'export default 1\n',
      codeLines: 44,
      framePage: '/playground/examples/shapes/rects/',
      moduleUrl: '/playground/examples/shapes/shapes-rects.ts',
    })
  })

  it('keeps the Host settings, the approved screenshot and a pending mark', () => {
    const [saves] = playgroundCatalog(
      [
        entry({
          id: 'core-saves',
          module: 'core',
          name: 'saves',
          path: 'core/core-saves.ts',
          header: { ...withoutGolden, host: { grant: ['saves'] }, pending: 'DX.2' },
          screenshot: 'core/core-saves.png',
        }),
      ],
      () => '',
    )
    expect(saves).toMatchObject({
      host: { grant: ['saves'] },
      pending: 'DX.2',
      screenshot: 'core/core-saves.png',
    })
    expect(saves).not.toHaveProperty('golden')
  })

  it('leaves out a file that is not a valid example, and sorts by id', () => {
    const catalog = playgroundCatalog(
      [
        entry({ id: 'zz-b', name: 'b' }),
        entry({ id: 'aa-a', name: 'a' }),
        entry({ id: 'bad', problems: ['no header'] }),
      ],
      () => '',
    )
    expect(catalog.map((example) => example.id)).toEqual(['aa-a', 'zz-b'])
  })

  // D-1 (M3 spec §4.8): the website is public, so an example of an unpublished extension (the closed beta's
  // render-pixi3d) never reaches it.
  it('leaves out an example that imports an unpublished extension', () => {
    const catalog = playgroundCatalog(
      [
        entry({ id: 'shapes-rects' }),
        entry({
          id: 'render3d-meshes',
          imports: ['@automataframework/automata', '@automataframework/automata-render-pixi3d/no-eval'],
        }),
      ],
      () => '',
    )
    expect(catalog.map((example) => example.id)).toEqual(['shapes-rects'])
  })
})
