import { describe, expect, it } from 'vitest'
import { packTile } from '#src/shared/level-2d/model/cells-codec.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { platformerTemplate } from '#src/shared/level-2d/profiles/level-project/templates/platformer.ts'
import { topdownRpgTemplate } from '#src/shared/level-2d/profiles/level-project/templates/topdown-rpg.ts'
import { isChosen, paletteOf } from '#src/shared/level-2d/tiles/palette-model.ts'

const platformer = (): Project => platformerTemplate.create(counterIds())

/** The platformer with its tileset given an image (16 px tiles, 8 columns, no spacing). */
function withImage(project: Project): Project {
  return {
    ...project,
    defs: {
      ...project.defs,
      tilesets: project.defs.tilesets.map((set) => ({
        ...set,
        image: 'assets/terrain.png',
        imageSize: { w: 128, h: 128 },
      })),
    },
  }
}

describe('the palette', () => {
  it('lists an IntGrid layer’s values by name and colour, painting their value', () => {
    const palette = paletteOf(platformer(), 'collision', new Set())
    expect(palette.items.map((item) => [item.kind, item.word, item.label])).toEqual([
      ['value', 1, 'Solid'],
      ['value', 2, 'One-way'],
      ['value', 3, 'Spike'],
      ['value', 4, 'Water'],
      ['value', 5, 'Ladder'],
    ])
    expect(palette.items[0]).toMatchObject({ color: expect.stringMatching(/^#[0-9a-f]{6}$/i) })
  })

  it('lists a tiles layer’s tileset tiles as packed words, placeholders while there is no image', () => {
    const palette = paletteOf(platformer(), 'decor', new Set())
    expect(palette.items.length).toBeGreaterThan(51)
    expect(palette.items[51]).toMatchObject({
      kind: 'tile',
      word: packTile(51, false, false),
      label: 'Tile 51',
    })
    expect(palette.items[51]).toMatchObject({ image: undefined, color: expect.stringMatching(/^#/) })
  })

  it('cuts each tile out of the tileset image once it is loaded', () => {
    const palette = paletteOf(withImage(platformer()), 'decor', new Set(['assets/terrain.png']))
    expect(palette.items[9]).toMatchObject({
      image: { path: 'assets/terrain.png', size: { w: 128, h: 128 }, frame: { x: 16, y: 16, w: 16, h: 16 } },
    })
  })

  it('gives an auto layer its tileset’s tiles, which the brush stamps as overrides', () => {
    const palette = paletteOf(platformer(), 'ground', new Set())
    expect(palette.items[0]).toMatchObject({ kind: 'tile', word: packTile(0, false, false) })
  })

  it('lists an entities layer’s definitions', () => {
    const palette = paletteOf(platformer(), 'entities', new Set())
    expect(palette.items.map((item) => item.kind === 'entity' && item.def)).toEqual(
      expect.arrayContaining(['player-start', 'slime', 'coin', 'door']),
    )
    expect(palette.items.find((item) => item.kind === 'entity' && item.def === 'coin')).toMatchObject({
      label: expect.any(String),
      color: expect.stringMatching(/^#/),
    })
  })

  it('gives an objects layer its tileset’s tiles', () => {
    const project = topdownRpgTemplate.create(counterIds())
    const palette = paletteOf(project, 'props', new Set())
    expect(palette.items[0]).toMatchObject({ kind: 'tile', word: packTile(0, false, false) })
  })

  it('is empty, saying so, for a layer it does not know', () => {
    expect(paletteOf(platformer(), 'gone', new Set()).items).toEqual([])
  })

  it('marks the choice the controller holds', () => {
    const [solid, spike] = [
      { kind: 'value', word: 1, label: 'Solid', color: '#000000' },
      { kind: 'value', word: 3, label: 'Spike', color: '#000000' },
    ] as const
    expect(isChosen(solid, { word: 1, entityDef: undefined })).toBe(true)
    expect(isChosen(spike, { word: 1, entityDef: undefined })).toBe(false)
    const coin = { kind: 'entity', def: 'coin', word: 0, label: 'Coin', color: '#000000' } as const
    expect(isChosen(coin, { word: 0, entityDef: 'coin' })).toBe(true)
    expect(isChosen(coin, { word: 0, entityDef: 'slime' })).toBe(false)
  })
})
