import type {
  ContentEntityDef,
  ContentLevel,
  ContentProject,
  ContentTileset,
} from '@automata/content/level-2d'
import { describe, expect, it } from 'vitest'
import { levelDrawList } from '#src/features/render/level-2d/level-draw-list.ts'

const tileset = (over: Partial<ContentTileset> = {}): ContentTileset => ({
  id: 'terrain',
  tile: { w: 16, h: 16 },
  columns: 8,
  rows: 8,
  spacing: 0,
  padding: 0,
  placeholder: true,
  tags: [],
  ...over,
})

const def = (over: Partial<ContentEntityDef> & { id: string }): ContentEntityDef => ({
  fields: [],
  shape: 'rect',
  size: { w: 16, h: 16 },
  pivot: { x: 0.5, y: 1 },
  resizable: 'none',
  tags: [],
  ...over,
})

/** The template's layer order: front to back. */
function project(over: Partial<ContentProject> = {}): ContentProject {
  return {
    format: 'af2d-content',
    version: 1,
    name: 'Levels',
    template: 'platformer',
    layers: [
      { id: 'entities', kind: 'entities', grid: 16, snap: true },
      { id: 'decor', kind: 'tiles', grid: 16, tileset: 'terrain' },
      { id: 'ground', kind: 'auto', grid: 16, source: 'collision', tileset: 'terrain' },
      { id: 'collision', kind: 'intgrid', grid: 16, values: [{ value: 1, id: 'solid' }] },
    ],
    tilesets: [tileset()],
    entities: [
      def({ id: 'player-start', color: '#22c55e', size: { w: 16, h: 24 } }),
      def({
        id: 'coin',
        color: '#facc15',
        shape: 'ellipse',
        size: { w: 8, h: 8 },
        pivot: { x: 0.5, y: 0.5 },
      }),
      def({ id: 'platform', color: '#94a3b8', size: { w: 48, h: 8 }, resizable: 'x', pivot: { x: 0, y: 0 } }),
    ],
    levelFields: [],
    ...over,
  }
}

function level(layers: ContentLevel['layers'], name = 'Cave'): ContentLevel {
  return {
    format: 'af2d-content',
    version: 1,
    id: 'cave',
    name,
    size: { w: 64, h: 32 },
    background: { color: '#1b2540', mode: 'fit' },
    fields: {},
    layers,
  }
}

const plain = level([
  { def: 'entities', kind: 'entities', items: [] },
  { def: 'decor', kind: 'tiles', rows: ['3 .', '.*2'] },
  { def: 'ground', kind: 'auto', stack: [{ rows: ['5 .'] }, { rows: ['. 6'] }] },
  { def: 'collision', kind: 'intgrid', rows: ['1 1', '. .'] },
])

describe('levelDrawList', () => {
  it('draws layers back to front, depth 0 before depth 1, and nothing for the IntGrid layer', () => {
    const draw = levelDrawList(project(), plain, new Set(), [])
    // Back to front is the reverse of the project: ground (depth 0, depth 1), then decor.
    expect(draw.items).toEqual([
      { kind: 'flat', color: '#6d5a8a', x: 0, y: 0, w: 16, h: 16, ellipse: false },
      { kind: 'flat', color: '#8a7f5a', x: 16, y: 0, w: 16, h: 16, ellipse: false },
      { kind: 'flat', color: '#8a5a7a', x: 0, y: 0, w: 16, h: 16, ellipse: false },
    ])
    expect(draw.background).toEqual({ color: '#1b2540', mode: 'fit' })
    expect(draw.problems).toEqual([])
  })

  it('cuts a tile from a loaded picture, with its flips', () => {
    const withImage = project({ tilesets: [tileset({ image: 'assets/terrain.png', placeholder: false })] })
    const drawn = levelDrawList(
      withImage,
      level([{ def: 'decor', kind: 'tiles', rows: ['9hv'] }]),
      new Set(['assets/terrain.png']),
      [],
    )
    expect(drawn.items).toEqual([
      {
        kind: 'tile',
        tile: 9,
        image: 'assets/terrain.png',
        frame: { x: 16, y: 16, w: 16, h: 16 },
        x: 0,
        y: 0,
        w: 16,
        h: 16,
        flipX: true,
        flipY: true,
      },
    ])
  })

  it('draws a coin as a flat ellipse about its pivot, and a resizable platform at its own size', () => {
    const lvl = level([
      {
        def: 'entities',
        kind: 'entities',
        items: [
          { id: 'c1', def: 'coin', x: 40, y: 20, fields: {} },
          { id: 'p1', def: 'platform', x: 8, y: 4, w: 24, h: 6, fields: {} },
        ],
      },
    ])
    expect(levelDrawList(project(), lvl, new Set(), []).items).toEqual([
      { kind: 'flat', color: '#facc15', x: 36, y: 16, w: 8, h: 8, ellipse: true, itemId: 'c1' },
      { kind: 'flat', color: '#94a3b8', x: 8, y: 4, w: 24, h: 6, ellipse: false, itemId: 'p1' },
    ])
  })

  it('draws an objects layer at the tileset tile size, top-left at the position', () => {
    const withObjects = project({
      layers: [{ id: 'props', kind: 'objects', tileset: 'terrain', snap: 1 }],
    })
    const lvl = level([
      {
        def: 'props',
        kind: 'objects',
        items: [{ id: 'o', tile: 2, x: 5, y: 7, flipX: false, flipY: false }],
      },
    ])
    expect(levelDrawList(withObjects, lvl, new Set(), []).items).toEqual([
      { kind: 'flat', color: '#7a8a5a', x: 5, y: 7, w: 16, h: 16, ellipse: false },
    ])
  })

  it('leaves out a character the game draws itself, and one the level never places', () => {
    const lvl = level([
      {
        def: 'entities',
        kind: 'entities',
        items: [{ id: 'p', def: 'player-start', x: 8, y: 24, fields: {} }],
      },
    ])
    expect(levelDrawList(project(), lvl, new Set(), ['player-start']).items).toEqual([])
    // A live id the level never places, and a level with no entities layer, are both fine.
    expect(levelDrawList(project(), lvl, new Set(), ['ghost']).items).toHaveLength(1)
    expect(levelDrawList(project(), level([]), new Set(), ['coin']).items).toEqual([])
  })

  it('falls back to a flat colour and says so once when the picture is missing', () => {
    const missing = project({ tilesets: [tileset({ image: 'assets/missing.png', placeholder: false })] })
    const lvl = level([{ def: 'decor', kind: 'tiles', rows: ['3 3'] }])
    const drawn = levelDrawList(missing, lvl, new Set(), [])
    expect(drawn.items.map((item) => item.kind)).toEqual(['flat', 'flat'])
    expect(drawn.problems).toEqual([
      'The level "Cave" uses the picture "assets/missing.png", which is not in the game.',
    ])
  })

  it('says which tile is past the set', () => {
    const lvl = level([{ def: 'decor', kind: 'tiles', rows: ['70'] }])
    const drawn = levelDrawList(project(), lvl, new Set(), [])
    expect(drawn.items).toHaveLength(1)
    expect(drawn.problems).toEqual(['The level "Cave" uses tile 70, but "terrain" has 64 tiles.'])
  })

  it('drops a background picture the game lacks and says so', () => {
    const lvl = {
      ...plain,
      background: { color: '#000000', image: 'assets/sky.png', mode: 'cover' as const },
    }
    const drawn = levelDrawList(project(), lvl, new Set(), [])
    expect(drawn.background).toEqual({ color: '#000000', mode: 'cover' })
    expect(drawn.problems).toEqual([
      'The level "Cave" uses the picture "assets/sky.png", which is not in the game.',
    ])
  })

  describe('a placed character with an animation', () => {
    const animation = {
      image: 'assets/coin.png',
      frame: { w: 8, h: 8 },
      clips: [{ id: 'spin', frames: [0, 1, 2, 3], fps: 8, loop: true }],
    }
    const spinning = project({
      entities: [
        def({ id: 'coin', color: '#facc15', size: { w: 8, h: 8 }, pivot: { x: 0.5, y: 0.5 }, animation }),
      ],
    })
    const placed = level([
      { def: 'entities', kind: 'entities', items: [{ id: 'c', def: 'coin', x: 24, y: 16, fields: {} }] },
    ])

    it('is drawn as its animation, in the box its pivot gives, when the picture is there', () => {
      const drawn = levelDrawList(spinning, placed, new Set(['assets/coin.png']), [])
      expect(drawn.items).toEqual([
        { kind: 'animation', animation, waiting: '#facc15', x: 20, y: 12, w: 8, h: 8, itemId: 'c' },
      ])
      expect(drawn.problems).toEqual([])
    })

    it('is its colour, with a sentence, when the picture is not in the game', () => {
      const drawn = levelDrawList(spinning, placed, new Set(), [])
      expect(drawn.items).toEqual([
        { kind: 'flat', color: '#facc15', x: 20, y: 12, w: 8, h: 8, ellipse: false, itemId: 'c' },
      ])
      expect(drawn.problems).toEqual([
        'The level "Cave" uses the picture "assets/coin.png", which is not in the game.',
      ])
    })
  })
})
